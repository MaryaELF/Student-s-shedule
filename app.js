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
            console.log("1. Начало импорта файла:", file.name);
            
            const sheetsData = await this.readExcelFile(file);
            console.log("2. Прочитано листов:", sheetsData.length);
            
            let totalAddedCount = 0;
            
            for (const sheet of sheetsData) {
                console.log(`3. Обработка листа: ${sheet.sheetName}`);
                console.log(`   Количество строк в листе: ${sheet.data.length}`);
                
                console.log("   Первые 5 строк:", sheet.data.slice(0, 5));
                
                const importedLessons = this.parseExcelData(sheet.data);
                console.log(`   Найдено занятий на листе: ${importedLessons.length}`);
                
                const addedCount = this.mergeScheduleData(importedLessons);
                totalAddedCount += addedCount;
                console.log(`   Добавлено занятий с листа: ${addedCount}`);
            }
            
            this.saveScheduleData();
            this.generateSchedule();
            this.showNotification(`Импортировано ${totalAddedCount} занятий!`, 'success');
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

    parseExcelData(data) {
        console.log("Начало парсинга Excel, количество строк:", data.length);
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
            
            let start = null, end = null;
            
            if (row[6]) {
                try {
                    if (typeof row[6] === 'number') {
                        start = excelDateToJSDate(row[6]);
                    } else if (typeof row[6] === 'string') {
                        start = new Date(row[6]);
                    }
                    if (start && isNaN(start.getTime())) start = null;
                } catch(e) {}
            }
            
            if (row[7]) {
                try {
                    if (typeof row[7] === 'number') {
                        end = excelDateToJSDate(row[7]);
                    } else if (typeof row[7] === 'string') {
                        end = new Date(row[7]);
                    }
                    if (end && isNaN(end.getTime())) end = null;
                } catch(e) {}
            }
            
            console.log(`Строка ${i}: ✓ НАЙДЕНО: ${subject}, день=${currentDay}, время=${timeIndex}`);
            
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
                startDate: start,
                endDate: end
            });
        }
        
        console.log(`ИТОГО НАЙДЕНО ЗАНЯТИЙ: ${lessons.length}`);
        return lessons;
    }

    mergeScheduleData(importedLessons) {
        let addedCount = 0;
        
        const getWeekNumber = (date) => {
            const start = new Date(this.startDate);
            const diffTime = date - start;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return Math.floor(diffDays / 7) + 1;
        };
        
        for (const item of importedLessons) {
            if (item.startDate && item.endDate) {
                let currentDate = new Date(item.startDate);
                const endDate = new Date(item.endDate);
                
                while (currentDate <= endDate) {
                    const weekNum = getWeekNumber(currentDate);
                    
                    if (weekNum >= 1 && weekNum <= 52) {
                        if (!this.scheduleData[weekNum]) this.scheduleData[weekNum] = {};
                        if (!this.scheduleData[weekNum][item.day]) this.scheduleData[weekNum][item.day] = {};
                        
                        if (!this.scheduleData[weekNum][item.day][item.time]) {
                            this.scheduleData[weekNum][item.day][item.time] = { ...item.lesson };
                            addedCount++;
                        }
                    }
                    
                    currentDate.setDate(currentDate.getDate() + 7);
                }
            } else {
                const weekNum = this.currentWeek;
                
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

    setupExportHandlers() {
        // Проверяем, существует ли уже кнопка, чтобы не создавать дубликат
        let exportBtn = document.getElementById('exportExcelBtn');
        if (!exportBtn) {
            exportBtn = document.createElement('button');
            exportBtn.id = 'exportExcelBtn';
            exportBtn.textContent = 'Экспорт Excel';
            exportBtn.style.marginLeft = '10px';
            
            const controls = document.querySelector('.controls');
            controls.appendChild(exportBtn);
        }

        exportBtn.addEventListener('click', () => {
            this.exportToExcel();
        });
    }

    exportToExcel() {
        try {
            // Проверяем, загружена ли библиотека XLSX
            if (typeof XLSX === 'undefined') {
                this.showNotification('Библиотека XLSX не загружена!', 'error');
                return;
            }

            const times = [
                '08:30-10:00', '10:10-11:40', '11:50-13:20',
                '13:50-15:20', '15:30-17:00', '17:10-18:40',
                '18:50-20:20'
            ];
            
            const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
            
            const weekDates = this.getWeekDates(this.currentWeek);
            
            const excelData = [];
            
            // Заголовок
            const headerRow = ['День / Время', ...times];
            excelData.push(headerRow);
            
            // Данные по дням
            let hasData = false;
            for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
                const dayDate = new Date(weekDates.start);
                dayDate.setDate(dayDate.getDate() + dayIndex);
                const dateStr = `${dayDate.getDate().toString().padStart(2, '0')}.${(dayDate.getMonth() + 1).toString().padStart(2, '0')}`;
                
                const row = [`${daysOfWeek[dayIndex]} (${dateStr})`];
                
                for (let timeIndex = 0; timeIndex < times.length; timeIndex++) {
                    const lesson = this.scheduleData[this.currentWeek]?.[dayIndex]?.[timeIndex];
                    if (lesson) {
                        hasData = true;
                        let cellValue = `${lesson.name}`;
                        if (lesson.teacher) cellValue += `\n${lesson.teacher}`;
                        if (lesson.room) cellValue += `\n${lesson.room}`;
                        if (lesson.type) cellValue += `\n${this.getTypeText(lesson.type)}`;
                        row.push(cellValue);
                    } else {
                        row.push('');
                    }
                }
                
                excelData.push(row);
            }
            
            if (!hasData) {
                this.showNotification('На текущей неделе нет занятий для экспорта!', 'error');
                return;
            }
            
            // Создаем книгу Excel
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            
            // Настраиваем ширину колонок
            ws['!cols'] = [
                { wch: 20 },
                ...times.map(() => ({ wch: 30 }))
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'Расписание');
            
            // Имя файла
            const dateStr = `${weekDates.start.getFullYear()}-${(weekDates.start.getMonth() + 1).toString().padStart(2, '0')}-${weekDates.start.getDate().toString().padStart(2, '0')}`;
            const filename = `Расписание_неделя_${this.currentWeek}_${dateStr}.xlsx`;
            
            // Сохраняем
            XLSX.writeFile(wb, filename);
            
            this.showNotification(`Расписание экспортировано в Excel (неделя ${this.currentWeek})!`, 'success');
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
