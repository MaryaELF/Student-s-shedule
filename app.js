class StudentSchedule {
    constructor() {
        this.startDate = new Date('2025-09-01');
        this.currentWeek = this.loadCurrentWeek() || 1;
        this.isEditMode = false;
        this.selectedCells = new Set();
        this.scheduleData = {};
        this.academicYear = this.getAcademicYear();
        
        this.loadAllData();
    }

    async loadAllData() {
        const saved = localStorage.getItem('studentSchedule');
        if (saved) {
            try {
                this.scheduleData = JSON.parse(saved);
                console.log('Данные загружены из localStorage');
                this.init();
                return;
            } catch(e) {
                console.warn('Ошибка парсинга localStorage', e);
            }
        }

        await this.loadDefaultSchedule();
        this.init();
    }

    async loadDefaultSchedule() {
        try {
            const response = await fetch('schedule.json');
            if (!response.ok) throw new Error('Файл schedule.json не найден');
            const data = await response.json();
            this.scheduleData = data;
            this.saveScheduleData();
            console.log('Загружено дефолтное расписание из schedule.json');
        } catch(e) {
            console.warn('Не удалось загрузить schedule.json, создаём пустое расписание');
            this.scheduleData = {};
            this.saveScheduleData();
        }
    }

    init() {
        this.generateSchedule();
        this.setupEventListeners();
        this.addQuickActions();
        this.setupImportHandlers();
        this.setupExportHandlers();
    }

    getWeekDates(weekNumber) {
        const start = new Date(this.startDate);
        start.setDate(start.getDate() + (weekNumber - 1) * 7);
        
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        
        return {
            start: start,
            end: end,
            formatted: this.formatDateRange(start, end)
        };
    }

    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}.${month}`;
    }

    formatDateRange(start, end) {
        return `${this.formatDate(start)} - ${this.formatDate(end)}`;
    }

    getDayWithDate(dayIndex, weekNumber) {
        const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const weekDates = this.getWeekDates(weekNumber);
        
        const dayDate = new Date(weekDates.start);
        dayDate.setDate(dayDate.getDate() + dayIndex);
        
        return `${daysOfWeek[dayIndex]} (${this.formatDate(dayDate)})`;
    }

    getAcademicYear() {
        const startYear = this.startDate.getFullYear();
        const endYear = this.startDate.getMonth() >= 8 ? startYear + 1 : startYear;
        return `${startYear}-${endYear}`;
    }

    generateSchedule() {
        const times = [
            '08:30-10:00', '10:10-11:40', '11:50-13:20',
            '13:50-15:20', '15:30-17:00', '17:10-18:40',
            '18:50-20:20'
        ];
        
        const scheduleBody = document.getElementById('scheduleBody');
        scheduleBody.innerHTML = '';

        const weekDates = this.getWeekDates(this.currentWeek);
        
        document.getElementById('currentWeek').textContent = weekDates.formatted;
        document.getElementById('currentWeek').dataset.weekNumber = this.currentWeek;

        for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
            const daySection = document.createElement('div');
            daySection.className = 'day-section';
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = this.getDayWithDate(dayIndex, this.currentWeek);
            daySection.appendChild(dayHeader);
            
            const dayLessons = document.createElement('div');
            dayLessons.className = 'day-lessons';
            
            times.forEach((time, timeIndex) => {
                const lessonRow = document.createElement('div');
                lessonRow.className = 'lesson-row';
                
                const timeCell = document.createElement('div');
                timeCell.className = 'lesson-time';
                timeCell.textContent = time;
                lessonRow.appendChild(timeCell);
                
                const contentCell = document.createElement('div');
                contentCell.className = 'lesson-content';
                contentCell.dataset.time = timeIndex;
                contentCell.dataset.day = dayIndex;
                contentCell.dataset.week = this.currentWeek;
                contentCell.onclick = () => this.handleCellClick(contentCell);
                
                const lesson = this.scheduleData[this.currentWeek]?.[dayIndex]?.[timeIndex];
                
                if (lesson) {
                    contentCell.classList.add('has-lesson');
                    const lessonDetails = document.createElement('div');
                    lessonDetails.className = 'lesson-details';
                    lessonDetails.style.setProperty('--lesson-color', lesson.color);
                    
                    lessonDetails.innerHTML = `
                        <h4>${lesson.name}</h4>
                        <p>${lesson.teacher || ''}</p>
                        <p>${lesson.room || ''}</p>
                        <small>${this.getTypeText(lesson.type)}</small>
                    `;
                    
                    contentCell.appendChild(lessonDetails);
                } else {
                    const emptyText = document.createElement('div');
                    emptyText.className = 'empty-lesson';
                    contentCell.appendChild(emptyText);
                }
                
                lessonRow.appendChild(contentCell);
                dayLessons.appendChild(lessonRow);
            });
            
            daySection.appendChild(dayLessons);
            scheduleBody.appendChild(daySection);
        }
    }

    handleCellClick(cell) {
        if (!this.isEditMode) return;

        const modal = document.getElementById('editModal');
        const form = document.getElementById('lessonForm');
        const deleteBtn = document.getElementById('deleteLesson');

        const [week, day, time] = [cell.dataset.week, cell.dataset.day, cell.dataset.time];
        const lesson = this.scheduleData[week]?.[day]?.[time];

        document.getElementById('editCellId').value = `${week}-${day}-${time}`;
        document.getElementById('lessonName').value = lesson?.name || '';
        document.getElementById('lessonTeacher').value = lesson?.teacher || '';
        document.getElementById('lessonRoom').value = lesson?.room || '';
        document.getElementById('lessonType').value = lesson?.type || 'lecture';
        document.getElementById('lessonColor').value = lesson?.color || '#8E89A7';

        deleteBtn.style.display = lesson ? 'block' : 'none';
        modal.style.display = 'block';

        form.onsubmit = (e) => {
            e.preventDefault();
            this.saveLesson();
        };
    }

    saveLesson() {
        const cellId = document.getElementById('editCellId').value;
        const [week, day, time] = cellId.split('-').map(Number);

        if (!this.scheduleData[week]) this.scheduleData[week] = {};
        if (!this.scheduleData[week][day]) this.scheduleData[week][day] = {};

        this.scheduleData[week][day][time] = {
            name: document.getElementById('lessonName').value,
            teacher: document.getElementById('lessonTeacher').value,
            room: document.getElementById('lessonRoom').value,
            type: document.getElementById('lessonType').value,
            color: document.getElementById('lessonColor').value
        };

        this.saveScheduleData();
        this.saveCurrentWeek();
        this.generateSchedule();
        this.closeModal();
    }

    deleteLesson() {
        const cellId = document.getElementById('editCellId').value;
        const [week, day, time] = cellId.split('-').map(Number);

        if (this.scheduleData[week]?.[day]?.[time]) {
            delete this.scheduleData[week][day][time];
            this.saveScheduleData();
            this.saveCurrentWeek();
            this.generateSchedule();
            this.closeModal();
        }
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    loadScheduleData() {
        const saved = localStorage.getItem('studentSchedule');
        return saved ? JSON.parse(saved) : null;
    }

    saveScheduleData() {
        localStorage.setItem('studentSchedule', JSON.stringify(this.scheduleData));
    }

    loadCurrentWeek() {
        const savedWeek = localStorage.getItem('currentWeek');
        return savedWeek ? parseInt(savedWeek) : null;
    }

    saveCurrentWeek() {
        localStorage.setItem('currentWeek', this.currentWeek.toString());
    }

    setupEventListeners() {
        document.getElementById('prevWeek').addEventListener('click', () => {
            if (this.currentWeek > 1) {
                this.currentWeek--;
                this.saveCurrentWeek();
                this.generateSchedule();
            }
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            this.currentWeek++;
            this.saveCurrentWeek();
            this.generateSchedule();
        });

        document.getElementById('editMode').addEventListener('click', () => {
            this.isEditMode = !this.isEditMode;
            this.toggleEditMode();
        });

        document.getElementById('duplicateBtn').addEventListener('click', () => {
            this.openDuplicateModal();
        });

        document.getElementById('currentWeekBtn').addEventListener('click', () => {
            this.goToCurrentWeek();
        });

        document.getElementById('confirmClearYes').addEventListener('click', () => {
            this.handleClearConfirmation(true);
        });

        document.getElementById('confirmClearNo').addEventListener('click', () => {
            this.handleClearConfirmation(false);
        });

        document.getElementById('duplicateType').addEventListener('change', (e) => {
            document.getElementById('daysSelection').style.display = 
                e.target.value === 'selected' ? 'block' : 'none';
        });

        document.getElementById('duplicateForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.duplicateLessons();
        });

        document.getElementById('cancelDuplicate').addEventListener('click', () => {
            this.closeDuplicateModal();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => this.closeModal());
        document.getElementById('deleteLesson').addEventListener('click', () => this.deleteLesson());

        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('editModal')) {
                this.closeModal();
            }
            if (e.target === document.getElementById('duplicateModal')) {
                this.closeDuplicateModal();
            }
            if (e.target === document.getElementById('confirmClearModal')) {
                this.handleClearConfirmation();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.isEditMode && e.ctrlKey) {
                this.enableMultiSelect();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!e.ctrlKey) {
                this.disableMultiSelect();
            }
        });
    }

    toggleEditMode() {
        const btn = document.getElementById('editMode');
        const cells = document.querySelectorAll('.lesson-content');
        
        if (this.isEditMode) {
            btn.textContent = 'Завершить редактирование';
            btn.style.background = '#f44336';
            cells.forEach(cell => cell.style.cursor = 'pointer');
        } else {
            btn.textContent = 'Редактировать';
            btn.style.background = '#8E89A7';
            cells.forEach(cell => cell.style.cursor = 'default');
            this.disableMultiSelect();
        }
    }

    getTypeText(type) {
        const types = {
            'lecture': 'Лекция',
            'lecture online': 'Лекция онлайн',
            'practice': 'Практика',
            'practice online': 'Практика онлайн'
        };
        return types[type] || type;
    }

    openDuplicateModal() {
        const sourceWeek = this.currentWeek;
        const sourceDates = this.getWeekDates(sourceWeek);
        
        document.getElementById('sourceWeek').value = sourceWeek;
        document.getElementById('sourceWeek').dataset.dates = sourceDates.formatted;
        
        const label = document.querySelector('label[for="sourceWeek"]');
        if (label) {
            label.textContent = `С недели: ${sourceDates.formatted}`;
        }
        
        document.getElementById('duplicateModal').style.display = 'block';
    }

    closeDuplicateModal() {
        document.getElementById('duplicateModal').style.display = 'none';
    }

    duplicateLessons() {
        const sourceWeek = parseInt(document.getElementById('sourceWeek').value);
        const targetWeeksInput = document.getElementById('targetWeeks').value;
        const duplicateType = document.getElementById('duplicateType').value;
        
        const targetWeeks = targetWeeksInput.split(',')
            .map(w => parseInt(w.trim()))
            .filter(w => !isNaN(w) && w > 0);

        if (targetWeeks.length === 0) {
            this.showNotification('Укажите целевые недели!', 'error');
            return;
        }

        let daysToDuplicate = [];
        if (duplicateType === 'selected') {
            daysToDuplicate = Array.from(document.querySelectorAll('input[name="day"]:checked'))
                .map(checkbox => parseInt(checkbox.value));
        } else {
            daysToDuplicate = [0, 1, 2, 3, 4, 5];
        }

        const sourceData = this.scheduleData[sourceWeek];
        if (!sourceData) {
            this.showNotification('Нет данных для выбранной недели!', 'error');
            return;
        }

        let duplicatedCount = 0;

        targetWeeks.forEach(targetWeek => {
            if (!this.scheduleData[targetWeek]) {
                this.scheduleData[targetWeek] = {};
            }

            daysToDuplicate.forEach(day => {
                if (sourceData[day]) {
                    this.scheduleData[targetWeek][day] = { ...sourceData[day] };
                    duplicatedCount += Object.keys(sourceData[day]).length;
                }
            });
        });

        this.saveScheduleData();
        this.saveCurrentWeek();
        this.closeDuplicateModal();
        this.showNotification(`Дублировано ${duplicatedCount} занятий на ${targetWeeks.length} недель!`);
        
        if (targetWeeks.includes(this.currentWeek)) {
            this.generateSchedule();
        }
    }

    enableMultiSelect() {
        const cells = document.querySelectorAll('.lesson-content.has-lesson');
        cells.forEach(cell => {
            cell.style.cursor = 'cell';
            cell.onclick = () => this.toggleCellSelection(cell);
        });
    }

    disableMultiSelect() {
        const cells = document.querySelectorAll('.lesson-content');
        cells.forEach(cell => {
            cell.style.cursor = this.isEditMode ? 'pointer' : 'default';
            cell.onclick = () => this.handleCellClick(cell);
            cell.style.border = '';
        });
        this.selectedCells.clear();
    }

    toggleCellSelection(cell) {
        const cellId = `${cell.dataset.week}-${cell.dataset.day}-${cell.dataset.time}`;
        
        if (this.selectedCells.has(cellId)) {
            this.selectedCells.delete(cellId);
            cell.style.border = '';
        } else {
            this.selectedCells.add(cellId);
            cell.style.border = '2px solid #ff5722';
        }
    }

    duplicateSelectedLessons(targetWeek) {
        if (this.selectedCells.size === 0) {
            this.showNotification('Выберите занятия для дублирования!', 'error');
            return;
        }

        if (!this.scheduleData[targetWeek]) {
            this.scheduleData[targetWeek] = {};
        }

        let duplicatedCount = 0;

        this.selectedCells.forEach(cellId => {
            const [sourceWeek, day, time] = cellId.split('-').map(Number);
            const lesson = this.scheduleData[sourceWeek]?.[day]?.[time];
            
            if (lesson) {
                if (!this.scheduleData[targetWeek][day]) {
                    this.scheduleData[targetWeek][day] = {};
                }
                
                this.scheduleData[targetWeek][day][time] = { ...lesson };
                duplicatedCount++;
            }
        });

        this.saveScheduleData();
        this.saveCurrentWeek();
        this.showNotification(`Дублировано ${duplicatedCount} занятий на неделю ${targetWeek}!`);
        this.disableMultiSelect();
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    addQuickActions() {
        const quickActions = `
            <div class="bulk-actions">
                <button onclick="studentSchedule.duplicateToNextWeek()">Дублировать на след. неделю</button>
                <button onclick="studentSchedule.clearCurrentWeek()">Очистить текущую неделю</button>
            </div>
        `;
        
        document.getElementById('quickActions').innerHTML = quickActions;
    }

    duplicateToNextWeek() {
        const targetWeek = this.currentWeek + 1;
        this.duplicateLessonsToWeek(this.currentWeek, targetWeek);
        this.saveCurrentWeek();
        this.showNotification(`Расписание дублировано на неделю ${targetWeek}!`);
    }

    duplicateLessonsToWeek(sourceWeek, targetWeek) {
        if (!this.scheduleData[sourceWeek]) return;

        this.scheduleData[targetWeek] = JSON.parse(JSON.stringify(this.scheduleData[sourceWeek]));
        this.saveScheduleData();
        this.saveCurrentWeek();
        
        if (targetWeek === this.currentWeek) {
            this.generateSchedule();
        }
    }

    clearCurrentWeek() {
        document.getElementById('confirmClearModal').style.display = 'block';
    }

    handleClearConfirmation(confirmed) {
        document.getElementById('confirmClearModal').style.display = 'none';
        
        if (confirmed) {
            this.scheduleData[this.currentWeek] = {};
            this.saveScheduleData();
            this.generateSchedule();
            this.showNotification('Неделя очищена!');
        }
    }

    goToCurrentWeek() {
        const today = new Date();
        const start = new Date(this.startDate);
        
        const diffTime = today - start;
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
        
        this.currentWeek = Math.max(1, diffWeeks);
        this.saveCurrentWeek();
        this.generateSchedule();
        this.showNotification('Переход к текущей неделе');
    }

    getCurrentWeekNumber() {
        const today = new Date();
        const start = new Date(this.startDate);
        const diffTime = today - start;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
    }

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

    async importFromExcel(file) {
        try {
            console.log("Начало импорта файла:", file.name);
            
            const sheetsData = await this.readExcelFile(file);
            console.log(`Прочитано листов: ${sheetsData.length}`);
            
            let totalAddedCount = 0;
            let weeksFound = [];
            let allLessons = [];
            
            for (const sheet of sheetsData) {
                console.log(`\nОбработка листа: "${sheet.sheetName}"`);
                console.log(`Количество строк в листе: ${sheet.data.length}`);
                
                let weekNumber = null;
                const sheetName = sheet.sheetName.trim();
                
                const weekMatch = sheetName.match(/(\d+)/);
                if (weekMatch) {
                    weekNumber = parseInt(weekMatch[1], 10);
                    console.log(`Определён номер недели из названия листа: ${weekNumber}`);
                    weeksFound.push(weekNumber);
                } else {
                    weekNumber = this.currentWeek;
                    console.log(`Номер недели не найден, используем текущую: ${weekNumber}`);
                }
                
                const importedLessons = this.parseExcelData(sheet.data, weekNumber);
                console.log(`Найдено занятий на листе: ${importedLessons.length}`);
                
                allLessons = allLessons.concat(importedLessons);
            }
            
            const addedCount = this.mergeScheduleData(allLessons);
            totalAddedCount = addedCount;
            
            this.saveScheduleData();
            this.generateSchedule();
            
            let message = `Импортировано ${totalAddedCount} занятий!`;
            if (weeksFound.length > 0) {
                const uniqueWeeks = [...new Set(weeksFound)].sort((a, b) => a - b);
                message += `\nНедели: ${uniqueWeeks.join(', ')}`;
            }
            this.showNotification(message, 'success');
            
        } catch (error) {
            console.error("ОШИБКА ПРИ ИМПОРТЕ:", error);
            console.error("Стек ошибки:", error.stack);
            this.showNotification(`Ошибка: ${error.message}`, 'error');
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

    parseExcelData(data, weekNumber) {
        console.log(`Парсинг Excel (неделя ${weekNumber}), строк: ${data.length}`);
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
        
        const excelDateToJSDate = (serial) => {
            if (typeof serial !== 'number') return null;
            const utc_days = Math.floor(serial - 25569);
            const utc_value = utc_days * 86400;
            return new Date(utc_value * 1000);
        };
        
        for (let i = 0; i < data.length; i++) {
            let row = data[i];
            if (!row || row.length === 0) continue;
            
            while (row.length < 8) {
                row.push('');
            }
            
            if (!headerSkipped && row[0] === 'День') {
                headerSkipped = true;
                console.log(`Строка ${i}: пропущена строка заголовков`);
                continue;
            }
            
            const dayCell = row[0] ? String(row[0]).trim() : '';
            
            if (dayCell && dayMap[dayCell] !== undefined) {
                currentDay = dayMap[dayCell];
                console.log(`Строка ${i}: УСТАНОВЛЕН ДЕНЬ = ${dayCell} (${currentDay})`);
                continue;
            }
            
            const subject = row[2] ? String(row[2]).trim() : '';
            if (!subject || subject === '') {
                continue;
            }
            
            if (currentDay === null) {
                console.log(`Строка ${i}: пропуск - нет дня для предмета "${subject}"`);
                continue;
            }
            
            const timeCell = row[1] ? String(row[1]).trim() : '';
            if (!timeCell || timeCell === '') {
                console.log(`Строка ${i}: пропуск - нет времени для "${subject}"`);
                continue;
            }
            
            const timeIndex = timeMap[timeCell];
            if (timeIndex === undefined) {
                console.log(`Строка ${i}: неизвестное время "${timeCell}"`);
                continue;
            }
            
            const teacher = row[3] ? String(row[3]).trim() : '';
            const room = row[4] ? String(row[4]).trim() : '';
            const typeRaw = row[5] ? String(row[5]).trim() : '';
            let lessonType = typeMap[typeRaw] || typeMap[typeRaw?.toLowerCase()] || 'lecture';
            
            let startDate = null, endDate = null;
            
            if (row[6]) {
                try {
                    if (typeof row[6] === 'number') {
                        startDate = excelDateToJSDate(row[6]);
                    } else if (typeof row[6] === 'string') {
                        startDate = new Date(row[6]);
                    }
                    if (startDate && isNaN(startDate.getTime())) startDate = null;
                } catch(e) {}
            }
            
            if (row[7]) {
                try {
                    if (typeof row[7] === 'number') {
                        endDate = excelDateToJSDate(row[7]);
                    } else if (typeof row[7] === 'string') {
                        endDate = new Date(row[7]);
                    }
                    if (endDate && isNaN(endDate.getTime())) endDate = null;
                } catch(e) {}
            }
            
            const lessonObj = {
                name: subject,
                teacher: teacher,
                room: room,
                type: lessonType,
                color: colors[lessonType] || '#8E89A7'
            };
            
            if (startDate && endDate) {
                console.log(`Диапазон: ${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`);
                lessons.push({
                    day: currentDay,
                    time: timeIndex,
                    lesson: lessonObj,
                    startDate: startDate,
                    endDate: endDate,
                    weekNumber: null
                });
            } else {
                const targetWeek = weekNumber || this.currentWeek;
                lessons.push({
                    day: currentDay,
                    time: timeIndex,
                    lesson: lessonObj,
                    startDate: null,
                    endDate: null,
                    weekNumber: targetWeek
                });
            }
        }
        
        console.log(`ИТОГО НАЙДЕНО ЗАНЯТИЙ НА ЛИСТЕ: ${lessons.length}`);
        return lessons;
    }

    mergeScheduleData(importedLessons) {
        let addedCount = 0;
        let skippedCount = 0;
        let duplicateCount = 0;
        
        const getWeekNumber = (date) => {
            const start = new Date(this.startDate);
            const diffTime = date - start;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return Math.floor(diffDays / 7) + 1;
        };
        
        console.log(`Начинаем объединение ${importedLessons.length} занятий...`);
        
        for (const item of importedLessons) {
            let targetWeeks = [];
            
            if (item.startDate && item.endDate) {
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
                targetWeeks = [item.weekNumber];
            } else {
                targetWeeks = [this.currentWeek];
            }
            
            for (const weekNum of targetWeeks) {
                if (weekNum < 1 || weekNum > 52) {
                    skippedCount++;
                    continue;
                }
                
                if (!this.scheduleData[weekNum]) {
                    this.scheduleData[weekNum] = {};
                }
                if (!this.scheduleData[weekNum][item.day]) {
                    this.scheduleData[weekNum][item.day] = {};
                }
                
                if (this.scheduleData[weekNum][item.day][item.time]) {
                    const existing = this.scheduleData[weekNum][item.day][item.time];
                    if (existing.name === item.lesson.name && 
                        existing.teacher === item.lesson.teacher) {
                        duplicateCount++;
                    } else {
                        console.warn(`Конфликт на неделе ${weekNum}, день ${item.day}, время ${item.time}:`);
                        console.warn(`   Было: ${existing.name} (${existing.teacher})`);
                        console.warn(`   Стало: ${item.lesson.name} (${item.lesson.teacher})`);
                        this.scheduleData[weekNum][item.day][item.time] = { ...item.lesson };
                        addedCount++;
                    }
                } else {
                    this.scheduleData[weekNum][item.day][item.time] = { ...item.lesson };
                    addedCount++;
                }
            }
        }
        
        console.log(`ИТОГИ ОБЪЕДИНЕНИЯ:`);
        console.log(`   Добавлено новых занятий: ${addedCount}`);
        if (duplicateCount > 0) console.log(`   Пропущено дубликатов: ${duplicateCount}`);
        if (skippedCount > 0) console.log(`   Пропущено (неверная неделя): ${skippedCount}`);
        
        return addedCount;
    }

    setupExportHandlers() {
        const exportBtn = document.getElementById('exportExcelBtn');
        if (exportBtn) {
            const newBtn = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newBtn, exportBtn);
            
            newBtn.addEventListener('click', () => {
                this.exportToExcel();
            });
        }
    }

    exportToExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                this.showNotification('Библиотека XLSX не загружена!', 'error');
                return;
            }

            const times = [
                '08:30-10:00', '10:10-11:40', '11:50-13:20',
                '13:50-15:20', '15:30-17:00', '17:10-18:40',
                '18:50-20:20'
            ];
            
            const daysOfWeek = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
            
            const wb = XLSX.utils.book_new();
            let hasData = false;
            
            const weeks = Object.keys(this.scheduleData).filter(w => {
                const weekNum = parseInt(w);
                return weekNum > 0 && Object.keys(this.scheduleData[w]).length > 0;
            }).map(Number).sort((a, b) => a - b);
            
            if (weeks.length === 0) {
                this.showNotification('Нет данных для экспорта!', 'error');
                return;
            }
            
            weeks.forEach(weekNum => {
                const weekData = this.scheduleData[weekNum];
                const weekDates = this.getWeekDates(weekNum);
                
                let sheetName = `Неделя ${weekNum}`;
                if (weekNum % 2 === 1) {
                    sheetName = `Верхняя неделя ${weekNum}`;
                } else {
                    sheetName = `Нижняя неделя ${weekNum}`;
                }
                if (sheetName.length > 31) {
                    sheetName = sheetName.substring(0, 31);
                }
                
                const excelData = [];
                const headerRow = ['День', 'Время', 'Предмет', 'Преподаватель', 'Аудитория', 'Тип', 'Дата начала', 'Дата конца'];
                excelData.push(headerRow);
                
                for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
                    let hasDayLessons = false;
                    for (let timeIndex = 0; timeIndex < times.length; timeIndex++) {
                        if (weekData[dayIndex]?.[timeIndex]) {
                            hasDayLessons = true;
                            break;
                        }
                    }
                    
                    if (hasDayLessons) {
                        const dayRow = [daysOfWeek[dayIndex], '', '', '', '', '', '', ''];
                        excelData.push(dayRow);
                        
                        for (let timeIndex = 0; timeIndex < times.length; timeIndex++) {
                            const lesson = weekData[dayIndex]?.[timeIndex];
                            if (lesson) {
                                hasData = true;
                                const row = [
                                    '',
                                    times[timeIndex],
                                    lesson.name || '',
                                    lesson.teacher || '',
                                    lesson.room || '',
                                    this.getTypeText(lesson.type) || '',
                                    '',
                                    ''
                                ];
                                excelData.push(row);
                            }
                        }
                    }
                }
                
                if (excelData.length > 1) {
                    const ws = XLSX.utils.aoa_to_sheet(excelData);
                    ws['!cols'] = [
                        { wch: 8 },
                        { wch: 15 },
                        { wch: 30 },
                        { wch: 25 },
                        { wch: 15 },
                        { wch: 15 },
                        { wch: 15 },
                        { wch: 15 }
                    ];
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                }
            });
            
            if (!hasData || wb.SheetNames.length === 0) {
                this.showNotification('Нет данных для экспорта!', 'error');
                return;
            }
            
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            const filename = `Расписание_${dateStr}.xlsx`;
            
            XLSX.writeFile(wb, filename);
            this.showNotification(`Расписание экспортировано в Excel (${wb.SheetNames.length} листов)!`, 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification(`Ошибка экспорта: ${error.message}`, 'error');
        }
    }
}

let studentSchedule;

document.addEventListener('DOMContentLoaded', async () => {
    studentSchedule = new StudentSchedule();
});

window.studentSchedule = studentSchedule;
