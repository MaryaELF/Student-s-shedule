// ============================================================
// ИМПОРТ (поддержка файлов с номерами недель в названиях листов)
// ============================================================

setupImportHandlers() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.id = 'importFileInput';
    document.body.appendChild(fileInput);
    
    document.getElementById('importExcelBtn').addEventListener('click', () => {
        fileInput.accept = '.xlsx, .xls';
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.name.match(/\.(xlsx|xls)$/i)) {
            this.importFromExcel(file);
        }
        
        fileInput.value = '';
    });
}

/**
 * Импорт Excel-файла.
 * - Ожидается, что в названиях листов есть номера недель (например, "Неделя 20")
 * - Если номер недели не найден — занятия добавляются на текущую неделю
 */
async importFromExcel(file) {
    try {
        console.log("📂 Начало импорта файла:", file.name);
        
        const sheetsData = await this.readExcelFile(file);
        console.log(`📄 Прочитано листов: ${sheetsData.length}`);
        
        let totalAddedCount = 0;
        let weeksFound = [];
        
        for (const sheet of sheetsData) {
            console.log(`\n🔍 Обработка листа: "${sheet.sheetName}"`);
            console.log(`   Количество строк в листе: ${sheet.data.length}`);
            
            // --- ОПРЕДЕЛЯЕМ НОМЕР НЕДЕЛИ ИЗ НАЗВАНИЯ ЛИСТА ---
            let weekNumber = null;
            const sheetName = sheet.sheetName.trim();
            
            // Ищем числа в названии листа (например, "Нижняя неделя 20" → 20)
            const weekMatch = sheetName.match(/(\d+)/);
            if (weekMatch) {
                weekNumber = parseInt(weekMatch[1], 10);
                console.log(`   🏷️ Определён номер недели из названия листа: ${weekNumber}`);
                weeksFound.push(weekNumber);
            } else {
                // Если номер недели не найден — используем текущую неделю
                weekNumber = this.currentWeek;
                console.log(`   📅 Номер недели не найден, используем текущую: ${weekNumber}`);
            }
            
            // Парсим данные листа
            const importedLessons = this.parseExcelData(sheet.data, weekNumber);
            console.log(`   📚 Найдено занятий на листе: ${importedLessons.length}`);
            
            // Сохраняем занятия в scheduleData
            const addedCount = this.mergeScheduleData(importedLessons);
            totalAddedCount += addedCount;
            console.log(`   ✅ Добавлено занятий с листа: ${addedCount}`);
        }
        
        this.saveScheduleData();
        this.generateSchedule();
        
        let message = `✅ Импортировано ${totalAddedCount} занятий!`;
        if (weeksFound.length > 0) {
            const uniqueWeeks = [...new Set(weeksFound)].sort((a, b) => a - b);
            message += `\n📅 Недели: ${uniqueWeeks.join(', ')}`;
        }
        this.showNotification(message, 'success');
        
    } catch (error) {
        console.error("❌ ОШИБКА ПРИ ИМПОРТЕ:", error);
        console.error("📋 Стек ошибки:", error.stack);
        this.showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let allData = [];
                for (let sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    allData.push({
                        sheetName: sheetName,
                        data: jsonData
                    });
                }
                resolve(allData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Парсит данные одного листа Excel.
 * @param {Array} data - массив строк листа
 * @param {number} weekNumber - номер недели (если не указан, будет использован fallback)
 */
parseExcelData(data, weekNumber) {
    console.log(`📝 Парсинг Excel (неделя ${weekNumber}), строк: ${data.length}`);
    const lessons = [];
    
    const dayMap = {
        'ПН': 0, 'Понедельник': 0, 'пн': 0,
        'ВТ': 1, 'Вторник': 1, 'вт': 1,
        'СР': 2, 'Среда': 2, 'ср': 2,
        'ЧТ': 3, 'Четверг': 3, 'чт': 3,
        'ПТ': 4, 'Пятница': 4, 'пт': 4,
        'СБ': 5, 'Суббота': 5, 'сб': 5
    };
    
    const timeMap = {
        '8:30-10:00': 0, '08:30-10:00': 0,
        '10:10-11:40': 1, '10:10-11:40': 1,
        '11:50-13:20': 2, '11:50-13:20': 2,
        '13:50-15:20': 3, '13:50-15:20': 3,
        '15:30-17:00': 4, '15:30-17:00': 4,
        '17:10-18:40': 5, '17:10-18:40': 5,
        '18:50-20:20': 6, '18:50-20:20': 6
    };
    
    const typeMap = {
        'лекция': 'lecture',
        'Лекция': 'lecture',
        'ЛЕКЦИЯ': 'lecture',
        'лекция онлайн': 'lecture online',
        'Лекция онлайн': 'lecture online',
        'ЛЕКЦИЯ ОНЛАЙН': 'lecture online',
        'практика': 'practice',
        'Практика': 'practice',
        'ПРАКТИКА': 'practice',
        'практика онлайн': 'practice online',
        'Практика онлайн': 'practice online',
        'ПРАКТИКА ОНЛАЙН': 'practice online'
    };
    
    const colors = {
        'lecture': '#8E89A7',
        'lecture online': '#6C63FF',
        'practice': '#4CAF50',
        'practice online': '#FF9800'
    };
    
    let currentDay = null;
    let headerSkipped = false;
    
    // Функция для преобразования Excel-даты (число) в объект Date
    const excelDateToJSDate = (serial) => {
        if (typeof serial !== 'number') return null;
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        return new Date(utc_value * 1000);
    };
    
    for (let i = 0; i < data.length; i++) {
        let row = data[i];
        if (!row || row.length === 0) continue;
        
        // Дополняем строку до 8 столбцов, если нужно
        while (row.length < 8) {
            row.push('');
        }
        
        // Пропускаем строку заголовков (если первый столбец = "День")
        if (!headerSkipped && row[0] === 'День') {
            headerSkipped = true;
            console.log(`   Строка ${i}: пропущена строка заголовков`);
            continue;
        }
        
        const dayCell = row[0] ? String(row[0]).trim() : '';
        
        // Если ячейка содержит день недели → устанавливаем currentDay
        if (dayCell && dayMap[dayCell] !== undefined) {
            currentDay = dayMap[dayCell];
            console.log(`   Строка ${i}: УСТАНОВЛЕН ДЕНЬ = ${dayCell} (${currentDay})`);
            continue;
        }
        
        const subject = row[2] ? String(row[2]).trim() : '';
        if (!subject || subject === '') {
            continue;
        }
        
        if (currentDay === null) {
            console.log(`   Строка ${i}: пропуск - нет дня для предмета "${subject}"`);
            continue;
        }
        
        const timeCell = row[1] ? String(row[1]).trim() : '';
        if (!timeCell || timeCell === '') {
            console.log(`   Строка ${i}: пропуск - нет времени для "${subject}"`);
            continue;
        }
        
        const timeIndex = timeMap[timeCell];
        if (timeIndex === undefined) {
            console.log(`   Строка ${i}: неизвестное время "${timeCell}"`);
            continue;
        }
        
        const teacher = row[3] ? String(row[3]).trim() : '';
        const room = row[4] ? String(row[4]).trim() : '';
        const typeRaw = row[5] ? String(row[5]).trim() : '';
        let lessonType = typeMap[typeRaw] || typeMap[typeRaw?.toLowerCase()] || 'lecture';
        
        // Парсим даты начала/конца (столбцы G и H, индексы 6 и 7)
        let startDate = null, endDate = null;
        
        // Столбец G (индекс 6) - дата начала
        if (row[6]) {
            try {
                if (typeof row[6] === 'number') {
                    startDate = excelDateToJSDate(row[6]);
                } else if (typeof row[6] === 'string') {
                    startDate = new Date(row[6]);
                }
                if (startDate && isNaN(startDate.getTime())) startDate = null;
            } catch(e) { /* игнорируем */ }
        }
        
        // Столбец H (индекс 7) - дата конца
        if (row[7]) {
            try {
                if (typeof row[7] === 'number') {
                    endDate = excelDateToJSDate(row[7]);
                } else if (typeof row[7] === 'string') {
                    endDate = new Date(row[7]);
                }
                if (endDate && isNaN(endDate.getTime())) endDate = null;
            } catch(e) { /* игнорируем */ }
        }
        
        // Если есть startDate и endDate, используем диапазон недель
        if (startDate && endDate) {
            console.log(`   📅 Диапазон: ${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`);
            lessons.push({
                day: currentDay,
                time: timeIndex,
                lesson: {
                    name: subject,
                    teacher: teacher,
                    room: room,
                    type: lessonType,
                    color: colors[lessonType] || '#8E89A7'
                },
                startDate: startDate,
                endDate: endDate
            });
        } else {
            // Если дат нет — добавляем на указанную неделю (или текущую)
            lessons.push({
                day: currentDay,
                time: timeIndex,
                lesson: {
                    name: subject,
                    teacher: teacher,
                    room: room,
                    type: lessonType,
                    color: colors[lessonType] || '#8E89A7'
                },
                weekNumber: weekNumber  // сохраняем номер недели для mergeScheduleData
            });
        }
    }
    
    console.log(`   ИТОГО НАЙДЕНО ЗАНЯТИЙ НА ЛИСТЕ: ${lessons.length}`);
    return lessons;
}

/**
 * Объединяет импортированные занятия с существующими данными.
 * Если у занятия есть startDate и endDate — раскладывает по всем неделям в диапазоне.
 * Если указан weekNumber — добавляет только на эту неделю.
 * Если ничего не указано — использует текущую неделю.
 */
mergeScheduleData(importedLessons) {
    let addedCount = 0;
    
    const getWeekNumber = (date) => {
        const start = new Date(this.startDate);
        const diffTime = date - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 7) + 1;
    };
    
    for (const item of importedLessons) {
        let targetWeeks = [];
        
        if (item.startDate && item.endDate) {
            // Раскладываем по всем неделям от startDate до endDate
            let currentDate = new Date(item.startDate);
            const endDate = new Date(item.endDate);
            
            while (currentDate <= endDate) {
                const weekNum = getWeekNumber(currentDate);
                if (weekNum >= 1 && weekNum <= 52) {
                    targetWeeks.push(weekNum);
                }
                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else if (item.weekNumber) {
            // Если указан конкретный номер недели
            targetWeeks = [item.weekNumber];
        } else {
            // fallback: текущая неделя
            targetWeeks = [this.currentWeek];
        }
        
        // Добавляем занятие на каждую целевую неделю
        for (const weekNum of targetWeeks) {
            if (weekNum < 1 || weekNum > 52) continue;
            
            if (!this.scheduleData[weekNum]) this.scheduleData[weekNum] = {};
            if (!this.scheduleData[weekNum][item.day]) this.scheduleData[weekNum][item.day] = {};
            
            if (!this.scheduleData[weekNum][item.day][item.time]) {
                this.scheduleData[weekNum][item.day][item.time] = { ...item.lesson };
                addedCount++;
            }
        }
    }
    
    return addedCount;
}
