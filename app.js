/**
 * 待办事项管理系统 - 核心应用逻辑
 * 功能模块：用户系统、任务管理、个人中心、后台管理
 */

// ==================== 全局配置和工具函数 ====================
const CONFIG = {
    TOKEN_KEY: 'todo_token',
    USER_KEY: 'todo_user',
    USERS_KEY: 'todo_users',
    TASKS_KEY: 'todo_tasks',
    CATEGORIES_KEY: 'todo_categories',
    PAGE_SIZE: 10,
    DEFAULT_AVATAR: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2UzZTRlNiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNDAiIHI9IjIwIiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTE1IDg1YTQwIDQwIDAgMCAxIDcwIDAiIGZpbGw9IiM5Y2EzYWYiLz48L3N2Zz4='
};

// 工具函数
const utils = {
    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 格式化日期
    formatDate(date, format = 'YYYY-MM-DD HH:mm') {
        if (!date) return '-';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hour)
            .replace('mm', minute);
    },

    // 检查是否逾期
    isOverdue(deadline) {
        if (!deadline) return false;
        return new Date(deadline) < new Date();
    },

    // 深拷贝
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // 防抖函数
    debounce(fn, delay = 300) {
        let timer = null;
        return function(...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    // 验证规则
    validators: {
        required(value, message = '此项不能为空') {
            return value && value.trim() ? '' : message;
        },
        
        username(value) {
            if (!value) return '用户名不能为空';
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
                return '用户名只能包含3-20位字母、数字或下划线';
            }
            return '';
        },
        
        password(value) {
            if (!value) return '密码不能为空';
            if (value.length < 6 || value.length > 20) {
                return '密码长度应为6-20位';
            }
            return '';
        },
        
        email(value) {
            if (!value) return '';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return '邮箱格式不正确';
            }
            return '';
        },
        
        confirmPassword(value, original) {
            if (!value) return '请确认密码';
            if (value !== original) return '两次输入的密码不一致';
            return '';
        }
    }
};

// ==================== 存储管理 ====================
const storage = {
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    }
};

// ==================== 认证管理 ====================
const auth = {
    // 当前用户
    currentUser: null,
    token: null,

    // 初始化
    init() {
        this.token = storage.get(CONFIG.TOKEN_KEY);
        this.currentUser = storage.get(CONFIG.USER_KEY);
        return this.isAuthenticated();
    },

    // 是否已认证
    isAuthenticated() {
        return !!(this.token && this.currentUser);
    },

    // 是否是管理员
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    // 登录
    login(username, password) {
        const users = storage.get(CONFIG.USERS_KEY) || [];
        const user = users.find(u => u.username === username && u.password === password);
        
        if (!user) {
            throw new Error('用户名或密码错误');
        }

        this.currentUser = utils.deepClone(user);
        delete this.currentUser.password;
        this.token = utils.generateId();
        
        storage.set(CONFIG.TOKEN_KEY, this.token);
        storage.set(CONFIG.USER_KEY, this.currentUser);
        
        return this.currentUser;
    },

    // 注册
    register(userData) {
        const users = storage.get(CONFIG.USERS_KEY) || [];
        
        if (users.some(u => u.username === userData.username)) {
            throw new Error('用户名已存在');
        }

        const newUser = {
            id: utils.generateId(),
            username: userData.username,
            password: userData.password,
            nickname: userData.nickname || userData.username,
            email: userData.email || '',
            avatar: CONFIG.DEFAULT_AVATAR,
            role: users.length === 0 ? 'admin' : 'user',
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        storage.set(CONFIG.USERS_KEY, users);

        // 自动登录
        return this.login(userData.username, userData.password);
    },

    // 退出登录
    logout() {
        this.currentUser = null;
        this.token = null;
        storage.remove(CONFIG.TOKEN_KEY);
        storage.remove(CONFIG.USER_KEY);
    },

    // 更新用户信息
    updateUser(userData) {
        const users = storage.get(CONFIG.USERS_KEY) || [];
        const index = users.findIndex(u => u.id === this.currentUser.id);
        
        if (index === -1) throw new Error('用户不存在');

        // 更新用户数据
        if (userData.nickname !== undefined) {
            users[index].nickname = userData.nickname;
            this.currentUser.nickname = userData.nickname;
        }
        if (userData.email !== undefined) {
            users[index].email = userData.email;
            this.currentUser.email = userData.email;
        }
        if (userData.avatar !== undefined) {
            users[index].avatar = userData.avatar;
            this.currentUser.avatar = userData.avatar;
        }

        storage.set(CONFIG.USERS_KEY, users);
        storage.set(CONFIG.USER_KEY, this.currentUser);
        
        return this.currentUser;
    },

    // 修改密码
    changePassword(currentPassword, newPassword) {
        const users = storage.get(CONFIG.USERS_KEY) || [];
        const index = users.findIndex(u => u.id === this.currentUser.id);
        
        if (index === -1) throw new Error('用户不存在');
        if (users[index].password !== currentPassword) {
            throw new Error('当前密码错误');
        }

        users[index].password = newPassword;
        storage.set(CONFIG.USERS_KEY, users);
        
        return true;
    }
};

// ==================== 任务管理 ====================
const taskManager = {
    // 获取所有任务
    getAll() {
        return storage.get(CONFIG.TASKS_KEY) || [];
    },

    // 获取当前用户的任务
    getUserTasks(userId) {
        const tasks = this.getAll();
        return tasks.filter(t => t.userId === userId);
    },

    // 根据ID获取任务
    getById(id) {
        const tasks = this.getAll();
        return tasks.find(t => t.id === id);
    },

    // 创建任务
    create(taskData) {
        const tasks = this.getAll();
        const newTask = {
            id: utils.generateId(),
            userId: auth.currentUser.id,
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            category: taskData.category || '',
            deadline: taskData.deadline || null,
            status: 'pending',
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        tasks.push(newTask);
        storage.set(CONFIG.TASKS_KEY, tasks);
        
        return newTask;
    },

    // 更新任务
    update(id, taskData) {
        const tasks = this.getAll();
        const index = tasks.findIndex(t => t.id === id);
        
        if (index === -1) throw new Error('任务不存在');
        if (tasks[index].userId !== auth.currentUser.id && !auth.isAdmin()) {
            throw new Error('无权修改此任务');
        }

        tasks[index] = { ...tasks[index], ...taskData };
        storage.set(CONFIG.TASKS_KEY, tasks);
        
        return tasks[index];
    },

    // 删除任务
    delete(id) {
        const tasks = this.getAll();
        const index = tasks.findIndex(t => t.id === id);
        
        if (index === -1) throw new Error('任务不存在');
        if (tasks[index].userId !== auth.currentUser.id && !auth.isAdmin()) {
            throw new Error('无权删除此任务');
        }

        tasks.splice(index, 1);
        storage.set(CONFIG.TASKS_KEY, tasks);
        
        return true;
    },

    // 切换任务状态
    toggleStatus(id) {
        const task = this.getById(id);
        if (!task) throw new Error('任务不存在');

        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        return this.update(id, {
            status: newStatus,
            completedAt: newStatus === 'completed' ? new Date().toISOString() : null
        });
    },

    // 筛选和排序任务
    filterTasks(options = {}) {
        let tasks = this.getUserTasks(auth.currentUser.id);

        // 关键词搜索
        if (options.keyword) {
            const keyword = options.keyword.toLowerCase();
            tasks = tasks.filter(t => 
                t.title.toLowerCase().includes(keyword) ||
                t.description.toLowerCase().includes(keyword)
            );
        }

        // 状态筛选
        if (options.status) {
            tasks = tasks.filter(t => t.status === options.status);
        }

        // 优先级筛选
        if (options.priority) {
            tasks = tasks.filter(t => t.priority === options.priority);
        }

        // 分类筛选
        if (options.category) {
            tasks = tasks.filter(t => t.category === options.category);
        }

        // 逾期筛选
        if (options.overdue) {
            tasks = tasks.filter(t => t.status !== 'completed' && utils.isOverdue(t.deadline));
        }

        // 排序
        if (options.sort) {
            switch (options.sort) {
                case 'created-desc':
                    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    break;
                case 'created-asc':
                    tasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    break;
                case 'deadline':
                    tasks.sort((a, b) => {
                        if (!a.deadline) return 1;
                        if (!b.deadline) return -1;
                        return new Date(a.deadline) - new Date(b.deadline);
                    });
                    break;
                case 'priority':
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
                    break;
            }
        }

        return tasks;
    },

    // 获取任务统计
    getStats(userId) {
        const tasks = userId ? this.getAll().filter(t => t.userId === userId) : this.getAll();
        const now = new Date();

        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            overdue: tasks.filter(t => 
                t.status !== 'completed' && utils.isOverdue(t.deadline)
            ).length
        };
    },

    // 获取紧急任务
    getUrgentTasks(userId) {
        const tasks = this.getUserTasks(userId);
        return tasks
            .filter(t => t.status !== 'completed')
            .sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            })
            .slice(0, 5);
    },

    // 获取今日任务
    getTodayTasks(userId) {
        const tasks = this.getUserTasks(userId);
        const today = new Date().toDateString();
        
        return tasks.filter(t => {
            if (t.status === 'completed') return false;
            if (!t.deadline) return false;
            return new Date(t.deadline).toDateString() === today;
        });
    },

    // 导出数据
    exportData(userId) {
        const tasks = this.getUserTasks(userId);
        const dataStr = JSON.stringify(tasks, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasks_${utils.formatDate(new Date(), 'YYYY-MM-DD')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // 导入数据
    importData(jsonData, userId) {
        try {
            const tasks = JSON.parse(jsonData);
            if (!Array.isArray(tasks)) throw new Error('数据格式错误');

            const allTasks = this.getAll();
            const newTasks = tasks.map(t => ({
                ...t,
                id: utils.generateId(),
                userId: userId,
                createdAt: new Date().toISOString()
            }));

            allTasks.push(...newTasks);
            storage.set(CONFIG.TASKS_KEY, allTasks);
            
            return newTasks.length;
        } catch (e) {
            throw new Error('导入失败：' + e.message);
        }
    },

    // 清空数据
    clearData(userId) {
        const tasks = this.getAll();
        const filtered = tasks.filter(t => t.userId !== userId);
        storage.set(CONFIG.TASKS_KEY, filtered);
    }
};

// ==================== 分类管理 ====================
const categoryManager = {
    getAll() {
        return storage.get(CONFIG.CATEGORIES_KEY) || [];
    },

    create(name) {
        const categories = this.getAll();
        
        if (categories.some(c => c.name === name)) {
            throw new Error('分类名称已存在');
        }

        const newCategory = {
            id: utils.generateId(),
            name: name,
            createdAt: new Date().toISOString()
        };

        categories.push(newCategory);
        storage.set(CONFIG.CATEGORIES_KEY, categories);
        
        return newCategory;
    },

    update(id, name) {
        const categories = this.getAll();
        const index = categories.findIndex(c => c.id === id);
        
        if (index === -1) throw new Error('分类不存在');
        if (categories.some(c => c.name === name && c.id !== id)) {
            throw new Error('分类名称已存在');
        }

        categories[index].name = name;
        storage.set(CONFIG.CATEGORIES_KEY, categories);
        
        return categories[index];
    },

    delete(id) {
        const categories = this.getAll();
        const index = categories.findIndex(c => c.id === id);
        
        if (index === -1) throw new Error('分类不存在');

        categories.splice(index, 1);
        storage.set(CONFIG.CATEGORIES_KEY, categories);
        
        return true;
    },

    getTaskCount(categoryId) {
        const tasks = taskManager.getAll();
        return tasks.filter(t => t.category === categoryId).length;
    }
};

// ==================== UI管理 ====================
const ui = {
    // 当前页面
    currentPage: 'home',
    
    // 当前任务ID（详情页使用）
    currentTaskId: null,
    
    // 确认回调
    confirmCallback: null,

    // 初始化
    init() {
        this.bindEvents();
        this.updateUI();
    },

    // 绑定事件
    bindEvents() {
        // 登录/注册切换
        document.getElementById('to-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // 登录表单
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 注册表单
        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // 密码可见性切换
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                if (target) {
                    target.type = target.type === 'password' ? 'text' : 'password';
                    btn.querySelector('i').classList.toggle('fa-eye');
                    btn.querySelector('i').classList.toggle('fa-eye-slash');
                }
            });
        });

        // 密码强度检测
        document.getElementById('reg-password')?.addEventListener('input', (e) => {
            this.checkPasswordStrength(e.target.value);
        });

        // 退出登录
        document.getElementById('btn-logout')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        document.getElementById('sidebar-logout')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // 移动端菜单切换
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar-mobile').classList.toggle('active');
        });

        // 页面导航
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = el.dataset.page;
                if (page) this.navigateTo(page);
            });
        });

        // 个人中心标签切换
        document.querySelectorAll('.profile-nav a[data-tab]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = el.dataset.tab;
                this.switchProfileTab(tab);
            });
        });

        // 后台管理标签切换
        document.querySelectorAll('.admin-tab').forEach(el => {
            el.addEventListener('click', () => {
                const tab = el.dataset.adminTab;
                this.switchAdminTab(tab);
            });
        });

        // 模态框关闭
        document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
            if (el.dataset.modal) {
                el.addEventListener('click', () => {
                    this.closeModal(el.dataset.modal);
                });
            }
        });

        // 新建任务
        document.getElementById('btn-new-task')?.addEventListener('click', () => {
            this.openTaskModal();
        });

        document.querySelector('[data-page="tasks"]')?.addEventListener('click', () => {
            if (this.currentPage === 'home') {
                setTimeout(() => this.openTaskModal(), 100);
            }
        });

        // 保存任务
        document.getElementById('btn-save-task')?.addEventListener('click', () => {
            this.saveTask();
        });

        // 返回按钮
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.navigateTo('tasks');
        });

        // 编辑任务
        document.getElementById('btn-edit-task')?.addEventListener('click', () => {
            this.openTaskModal(this.currentTaskId);
        });

        // 删除任务
        document.getElementById('btn-delete-task')?.addEventListener('click', () => {
            this.showConfirm('确定要删除这个任务吗？', () => {
                this.deleteTask(this.currentTaskId);
            });
        });

        // 切换任务状态
        document.getElementById('btn-toggle-status')?.addEventListener('click', () => {
            this.toggleTaskStatus(this.currentTaskId);
        });

        // 任务筛选
        document.getElementById('task-search')?.addEventListener('input', 
            utils.debounce(() => this.loadTaskList(), 300)
        );

        document.getElementById('filter-status')?.addEventListener('change', () => {
            this.loadTaskList();
        });

        document.getElementById('filter-priority')?.addEventListener('change', () => {
            this.loadTaskList();
        });

        document.getElementById('filter-category')?.addEventListener('change', () => {
            this.loadTaskList();
        });

        document.getElementById('task-sort')?.addEventListener('change', () => {
            this.loadTaskList();
        });

        // 个人资料表单
        document.getElementById('profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        // 密码修改表单
        document.getElementById('password-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // 头像上传
        document.getElementById('avatar-input')?.addEventListener('change', (e) => {
            this.uploadAvatar(e.target.files[0]);
        });

        // 数据导出
        document.getElementById('btn-export')?.addEventListener('click', () => {
            taskManager.exportData(auth.currentUser.id);
            this.showToast('数据导出成功', 'success');
        });

        // 数据导入
        document.getElementById('btn-import')?.addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        // 清空数据
        document.getElementById('btn-clear')?.addEventListener('click', () => {
            this.showConfirm('确定要清空所有任务数据吗？此操作不可恢复！', () => {
                taskManager.clearData(auth.currentUser.id);
                this.showToast('数据已清空', 'success');
                this.loadHomePage();
            });
        });

        // 确认对话框
        document.getElementById('btn-confirm')?.addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback();
                this.confirmCallback = null;
            }
            this.closeModal('confirm-modal');
        });

        // 用户搜索
        document.getElementById('user-search')?.addEventListener('input',
            utils.debounce(() => this.loadUserList(), 300)
        );

        // 新建分类
        document.getElementById('btn-new-category')?.addEventListener('click', () => {
            this.openCategoryModal();
        });

        // 保存分类
        document.getElementById('btn-save-category')?.addEventListener('click', () => {
            this.saveCategory();
        });
    },

    // 显示登录表单
    showLoginForm() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        this.clearErrors();
    },

    // 显示注册表单
    showRegisterForm() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        this.clearErrors();
    },

    // 清除错误信息
    clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'));
    },

    // 显示字段错误
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + '-error');
        if (field) field.classList.add('error');
        if (errorEl) errorEl.textContent = message;
    },

    // 检查密码强度
    checkPasswordStrength(password) {
        const strengthBar = document.querySelector('#password-strength .strength-bar');
        if (!strengthBar) return;

        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 10) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        strengthBar.className = 'strength-bar';
        if (strength <= 2) {
            strengthBar.classList.add('weak');
        } else if (strength <= 4) {
            strengthBar.classList.add('medium');
        } else {
            strengthBar.classList.add('strong');
        }
    },

    // 处理登录
    handleLogin() {
        this.clearErrors();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        // 验证
        let hasError = false;
        if (!username) {
            this.showFieldError('login-username', '请输入用户名');
            hasError = true;
        }
        if (!password) {
            this.showFieldError('login-password', '请输入密码');
            hasError = true;
        }
        if (hasError) return;

        try {
            auth.login(username, password);
            this.showToast('登录成功', 'success');
            this.updateUI();
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // 处理注册
    handleRegister() {
        this.clearErrors();

        const username = document.getElementById('reg-username').value.trim();
        const nickname = document.getElementById('reg-nickname').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const email = document.getElementById('reg-email').value.trim();

        // 验证
        let hasError = false;

        const usernameError = utils.validators.username(username);
        if (usernameError) {
            this.showFieldError('reg-username', usernameError);
            hasError = true;
        }

        const passwordError = utils.validators.password(password);
        if (passwordError) {
            this.showFieldError('reg-password', passwordError);
            hasError = true;
        }

        const confirmError = utils.validators.confirmPassword(confirmPassword, password);
        if (confirmError) {
            this.showFieldError('reg-confirm-password', confirmError);
            hasError = true;
        }

        const emailError = utils.validators.email(email);
        if (emailError) {
            this.showFieldError('reg-email', emailError);
            hasError = true;
        }

        if (hasError) return;

        try {
            auth.register({ username, nickname, password, email });
            this.showToast('注册成功', 'success');
            this.updateUI();
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // 处理退出
    handleLogout() {
        auth.logout();
        this.showToast('已退出登录', 'info');
        this.updateUI();
    },

    // 更新UI
    updateUI() {
        const isAuth = auth.isAuthenticated();

        if (isAuth) {
            // 显示主应用
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            
            // 更新用户信息
            this.updateUserInfo();
            
            // 加载页面数据
            this.loadCurrentPage();
            
            // 显示/隐藏管理员菜单
            const adminNav = document.getElementById('admin-nav-item');
            const sidebarAdmin = document.getElementById('sidebar-admin-item');
            if (auth.isAdmin()) {
                adminNav.style.display = 'flex';
                sidebarAdmin.style.display = 'flex';
            } else {
                adminNav.style.display = 'none';
                sidebarAdmin.style.display = 'none';
            }
        } else {
            // 显示登录页
            document.getElementById('auth-page').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
            this.showLoginForm();
        }

        // 隐藏加载遮罩
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
        }, 500);
    },

    // 更新用户信息显示
    updateUserInfo() {
        const user = auth.currentUser;
        if (!user) return;

        // 更新头像和用户名
        const avatarElements = document.querySelectorAll('#header-avatar, #sidebar-avatar, #profile-avatar');
        avatarElements.forEach(el => {
            if (el) el.src = user.avatar || CONFIG.DEFAULT_AVATAR;
        });

        const usernameElements = document.querySelectorAll('#header-username, #sidebar-username, #profile-username, #hero-username');
        usernameElements.forEach(el => {
            if (el) el.textContent = user.nickname || user.username;
        });

        // 更新个人中心表单
        const nicknameInput = document.getElementById('profile-nickname-input');
        const emailInput = document.getElementById('profile-email-input');
        const usernameInput = document.getElementById('profile-username-input');
        const regtimeInput = document.getElementById('profile-regtime');

        if (nicknameInput) nicknameInput.value = user.nickname || '';
        if (emailInput) emailInput.value = user.email || '';
        if (usernameInput) usernameInput.value = user.username;
        if (regtimeInput) regtimeInput.value = utils.formatDate(user.createdAt);
    },

    // 页面导航
    navigateTo(page) {
        this.currentPage = page;
        
        // 更新导航状态
        document.querySelectorAll('.nav-item, .sidebar-nav a[data-page]').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.page === page) {
                el.classList.add('active');
            }
        });

        // 切换页面
        document.querySelectorAll('.page').forEach(el => {
            el.classList.remove('active');
        });

        const pageEl = document.getElementById('page-' + page);
        if (pageEl) pageEl.classList.add('active');

        // 关闭移动端菜单
        document.getElementById('sidebar-mobile').classList.remove('active');

        // 加载页面数据
        this.loadCurrentPage();
    },

    // 加载当前页面
    loadCurrentPage() {
        switch (this.currentPage) {
            case 'home':
                this.loadHomePage();
                break;
            case 'tasks':
                this.loadTaskList();
                break;
            case 'admin':
                this.loadAdminPage();
                break;
        }
    },

    // 加载首页
    loadHomePage() {
        const user = auth.currentUser;
        if (!user) return;

        // 更新统计
        const stats = taskManager.getStats(user.id);
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-pending').textContent = stats.pending;
        document.getElementById('stat-completed').textContent = stats.completed;
        document.getElementById('stat-overdue').textContent = stats.overdue;
        document.getElementById('hero-pending').textContent = stats.pending;

        // 加载紧急任务
        const urgentTasks = taskManager.getUrgentTasks(user.id);
        const urgentContainer = document.getElementById('urgent-tasks');
        if (urgentContainer) {
            if (urgentTasks.length === 0) {
                urgentContainer.innerHTML = '<p class="empty-text">暂无紧急任务</p>';
            } else {
                urgentContainer.innerHTML = urgentTasks.map(task => this.createTaskPreviewHTML(task)).join('');
            }
        }

        // 加载今日任务
        const todayTasks = taskManager.getTodayTasks(user.id);
        const todayContainer = document.getElementById('today-tasks');
        if (todayContainer) {
            if (todayTasks.length === 0) {
                todayContainer.innerHTML = '<p class="empty-text">今日暂无待办</p>';
            } else {
                todayContainer.innerHTML = todayTasks.map(task => this.createTaskPreviewHTML(task)).join('');
            }
        }
    },

    // 创建任务预览HTML
    createTaskPreviewHTML(task) {
        return `
            <div class="task-preview-item" data-id="${task.id}">
                <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                    onchange="ui.toggleTaskStatus('${task.id}')">
                <div class="task-preview-content">
                    <div class="task-preview-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-preview-meta">
                        ${task.deadline ? utils.formatDate(task.deadline, 'MM-DD HH:mm') : '无截止日期'}
                    </div>
                </div>
                <span class="priority-badge ${task.priority}">
                    ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                </span>
            </div>
        `;
    },

    // 加载任务列表
    loadTaskList(page = 1) {
        const user = auth.currentUser;
        if (!user) return;

        // 更新分类筛选器
        this.updateCategoryFilter();

        // 获取筛选条件
        const keyword = document.getElementById('task-search')?.value || '';
        const status = document.getElementById('filter-status')?.value || '';
        const priority = document.getElementById('filter-priority')?.value || '';
        const category = document.getElementById('filter-category')?.value || '';
        const sort = document.getElementById('task-sort')?.value || 'created-desc';

        // 筛选任务
        let tasks = taskManager.filterTasks({
            keyword,
            status,
            priority,
            category,
            sort
        });

        // 分页
        const totalPages = Math.ceil(tasks.length / CONFIG.PAGE_SIZE);
        const start = (page - 1) * CONFIG.PAGE_SIZE;
        const pageTasks = tasks.slice(start, start + CONFIG.PAGE_SIZE);

        // 渲染任务列表
        const container = document.getElementById('task-list');
        if (container) {
            if (pageTasks.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>暂无任务</p></div>';
            } else {
                container.innerHTML = pageTasks.map(task => this.createTaskItemHTML(task)).join('');
            }
        }

        // 渲染分页
        this.renderPagination('pagination', page, totalPages, (p) => this.loadTaskList(p));
    },

    // 创建任务项HTML
    createTaskItemHTML(task) {
        const categories = categoryManager.getAll();
        const category = categories.find(c => c.id === task.category);
        const isOverdue = task.status !== 'completed' && utils.isOverdue(task.deadline);

        return `
            <div class="task-item ${task.status}" data-id="${task.id}">
                <span class="col-checkbox" data-label="">
                    <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                        onchange="ui.toggleTaskStatus('${task.id}')">
                </span>
                <span class="col-title" data-label="标题：">
                    <span class="task-title" onclick="ui.viewTask('${task.id}')">${this.escapeHtml(task.title)}</span>
                </span>
                <span class="col-priority" data-label="优先级：">
                    <span class="priority-badge ${task.priority}">
                        ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                    </span>
                </span>
                <span class="col-category" data-label="分类：">${category ? this.escapeHtml(category.name) : '-'}</span>
                <span class="col-deadline" data-label="截止日期：">
                    ${task.deadline ? utils.formatDate(task.deadline, 'MM-DD HH:mm') : '-'}
                </span>
                <span class="col-status" data-label="状态：">
                    <span class="status-badge ${isOverdue ? 'overdue' : task.status}">
                        ${isOverdue ? '已逾期' : task.status === 'completed' ? '已完成' : '进行中'}
                    </span>
                </span>
                <span class="col-actions" data-label="操作：">
                    <div class="task-actions">
                        <button onclick="ui.viewTask('${task.id}')" title="查看">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="ui.openTaskModal('${task.id}')" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete" onclick="ui.confirmDeleteTask('${task.id}')" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </span>
            </div>
        `;
    },

    // 渲染分页
    renderPagination(containerId, currentPage, totalPages, callback) {
        const container = document.getElementById(containerId);
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = `
            <button ${currentPage === 1 ? 'disabled' : ''} onclick="${callback.name}(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callback.name}(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += '<span>...</span>';
            }
        }

        html += `
            <button ${currentPage === totalPages ? 'disabled' : ''} onclick="${callback.name}(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = html;
    },

    // 更新分类筛选器
    updateCategoryFilter() {
        const categories = categoryManager.getAll();
        const selects = document.querySelectorAll('#filter-category, #edit-task-category');
        
        selects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '<option value="">未分类</option>' +
                categories.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
            select.value = currentValue;
        });
    },

    // 查看任务详情
    viewTask(id) {
        const task = taskManager.getById(id);
        if (!task) return;

        this.currentTaskId = id;

        // 填充详情
        const categories = categoryManager.getAll();
        const category = categories.find(c => c.id === task.category);
        const isOverdue = task.status !== 'completed' && utils.isOverdue(task.deadline);

        document.getElementById('detail-title').textContent = task.title;
        document.getElementById('detail-desc').textContent = task.description || '暂无描述';
        document.getElementById('detail-created').textContent = utils.formatDate(task.createdAt);
        document.getElementById('detail-deadline').textContent = task.deadline ? utils.formatDate(task.deadline) : '-';
        document.getElementById('detail-completed').textContent = task.completedAt ? utils.formatDate(task.completedAt) : '-';
        
        const statusEl = document.getElementById('detail-status');
        statusEl.className = 'task-status-badge ' + (isOverdue ? 'overdue' : task.status);
        statusEl.innerHTML = isOverdue ? '<i class="fas fa-exclamation-circle"></i> 已逾期' : 
            task.status === 'completed' ? '<i class="fas fa-check-circle"></i> 已完成' : 
            '<i class="fas fa-clock"></i> 进行中';

        document.getElementById('detail-priority').innerHTML = `<span class="priority-badge ${task.priority}">
            ${task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
        </span>`;
        document.getElementById('detail-category').textContent = category ? category.name : '未分类';

        // 更新按钮状态
        const toggleBtn = document.getElementById('btn-toggle-status');
        if (task.status === 'completed') {
            toggleBtn.innerHTML = '<i class="fas fa-undo"></i> 标记未完成';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-check"></i> 标记完成';
        }

        this.navigateTo('detail');
    },

    // 打开任务编辑模态框
    openTaskModal(taskId = null) {
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('task-modal-title');
        const form = document.getElementById('task-edit-form');

        this.updateCategoryFilter();

        if (taskId) {
            const task = taskManager.getById(taskId);
            if (!task) return;

            title.textContent = '编辑任务';
            document.getElementById('edit-task-id').value = task.id;
            document.getElementById('edit-task-title').value = task.title;
            document.getElementById('edit-task-desc').value = task.description || '';
            document.getElementById('edit-task-priority').value = task.priority;
            document.getElementById('edit-task-category').value = task.category || '';
            document.getElementById('edit-task-deadline').value = task.deadline ? 
                task.deadline.slice(0, 16) : '';
        } else {
            title.textContent = '新建任务';
            form.reset();
            document.getElementById('edit-task-id').value = '';
        }

        this.clearErrors();
        modal.classList.add('active');
    },

    // 保存任务
    saveTask() {
        this.clearErrors();

        const id = document.getElementById('edit-task-id').value;
        const title = document.getElementById('edit-task-title').value.trim();
        const description = document.getElementById('edit-task-desc').value.trim();
        const priority = document.getElementById('edit-task-priority').value;
        const category = document.getElementById('edit-task-category').value;
        const deadline = document.getElementById('edit-task-deadline').value;

        // 验证
        if (!title) {
            this.showFieldError('edit-task-title', '请输入任务标题');
            return;
        }

        try {
            if (id) {
                taskManager.update(id, { title, description, priority, category, deadline });
                this.showToast('任务更新成功', 'success');
            } else {
                taskManager.create({ title, description, priority, category, deadline });
                this.showToast('任务创建成功', 'success');
            }

            this.closeModal('task-modal');
            this.loadCurrentPage();
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // 切换任务状态
    toggleTaskStatus(id) {
        try {
            taskManager.toggleStatus(id);
            this.loadCurrentPage();
            
            if (this.currentPage === 'detail' && this.currentTaskId === id) {
                this.viewTask(id);
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // 确认删除任务
    confirmDeleteTask(id) {
        this.showConfirm('确定要删除这个任务吗？', () => {
            this.deleteTask(id);
        });
    },

    // 删除任务
    deleteTask(id) {
        try {
            taskManager.delete(id);
            this.showToast('任务已删除', 'success');
            
            if (this.currentPage === 'detail') {
                this.navigateTo('tasks');
            } else {
                this.loadCurrentPage();
            }
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // 切换个人中心标签
    switchProfileTab(tab) {
        document.querySelectorAll('.profile-nav a').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.tab === tab) el.classList.add('active');
        });

        document.querySelectorAll('.profile-tab').forEach(el => {
            el.classList.remove('active');
        });

        const tabEl = document.getElementById('tab-' + tab);
        if (tabEl) tabEl.classList.add('active');
    },

    // 更新个人资料
    updateProfile() {
        const nickname = document.getElementById('profile-nickname-input').value.trim();
        const email = document.getElementById('profile-email-input').value.trim();

        const emailError = utils.validators.email(email);
        if (emailError) {
            this.showToast(emailError, 'error');
            return;
        }

        try {
            auth.updateUser({ nickname, email });
            this.updateUserInfo();
            this.showToast('资料更新成功', 'success');
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    },

    // 修改密码
    changePassword() {
        this.clearErrors();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;

        let hasError = false;

        if (!currentPassword) {
            this.showFieldError('current-password', '请输入当前密码');
            hasError = true;
        }

        const passwordError = utils.validators.password(newPassword);
        if (passwordError) {
            this.showFieldError('new-password', passwordError);
            hasError = true;
        }

        const confirmError = utils.validators.confirmPassword(confirmPassword, newPassword);
        if (confirmError) {
            this.showFieldError('confirm-new-password', confirmError);
            hasError = true;
        }

        if (hasError) return;

        try {
            auth.changePassword(currentPassword, newPassword);
            document.getElementById('password-form').reset();
            this.showToast('密码修改成功', 'success');
        } catch (e) {
            this.showFieldError('current-password', e.message);
        }
    },

    // 上传头像
    uploadAvatar(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('请选择图片文件', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            this.showToast('图片大小不能超过2MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                auth.updateUser({ avatar: e.target.result });
                this.updateUserInfo();
                this.showToast('头像上传成功', 'success');
            } catch (err) {
                this.showToast('头像上传失败', 'error');
            }
        };
        reader.readAsDataURL(file);
    },

    // 导入数据
    importData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const count = taskManager.importData(e.target.result, auth.currentUser.id);
                this.showToast(`成功导入 ${count} 个任务`, 'success');
                this.loadHomePage();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        };
        reader.readAsText(file);
    },

    // 加载后台管理页面
    loadAdminPage() {
        if (!auth.isAdmin()) {
            this.navigateTo('home');
            this.showToast('无权访问此页面', 'error');
            return;
        }

        this.loadUserList();
        this.loadCategoryList();
        this.loadSystemInfo();
    },

    // 切换后台管理标签
    switchAdminTab(tab) {
        document.querySelectorAll('.admin-tab').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.adminTab === tab) el.classList.add('active');
        });

        document.querySelectorAll('.admin-content').forEach(el => {
            el.classList.remove('active');
        });

        const tabEl = document.getElementById('admin-' + tab);
        if (tabEl) tabEl.classList.add('active');
    },

    // 加载用户列表
    loadUserList(page = 1) {
        const keyword = document.getElementById('user-search')?.value || '';
        let users = storage.get(CONFIG.USERS_KEY) || [];

        if (keyword) {
            users = users.filter(u => 
                u.username.includes(keyword) || 
                u.nickname.includes(keyword) ||
                u.email.includes(keyword)
            );
        }

        const totalPages = Math.ceil(users.length / CONFIG.PAGE_SIZE);
        const start = (page - 1) * CONFIG.PAGE_SIZE;
        const pageUsers = users.slice(start, start + CONFIG.PAGE_SIZE);

        const tbody = document.getElementById('user-table-body');
        if (tbody) {
            tbody.innerHTML = pageUsers.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${this.escapeHtml(user.username)}</td>
                    <td>${this.escapeHtml(user.nickname)}</td>
                    <td>${user.email || '-'}</td>
                    <td>${user.role === 'admin' ? '管理员' : '普通用户'}</td>
                    <td>${utils.formatDate(user.createdAt)}</td>
                    <td class="actions">
                        <button class="btn-edit" onclick="ui.editUserRole('${user.id}')">
                            ${user.role === 'admin' ? '取消管理员' : '设为管理员'}
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        this.renderPagination('user-pagination', page, totalPages, (p) => this.loadUserList(p));
    },

    // 编辑用户角色
    editUserRole(userId) {
        const users = storage.get(CONFIG.USERS_KEY) || [];
        const user = users.find(u => u.id === userId);
        if (!user) return;

        user.role = user.role === 'admin' ? 'user' : 'admin';
        storage.set(CONFIG.USERS_KEY, users);
        
        this.loadUserList();
        this.showToast('用户角色已更新', 'success');
    },

    // 加载分类列表
    loadCategoryList() {
        const categories = categoryManager.getAll();
        const tbody = document.getElementById('category-table-body');
        
        if (tbody) {
            tbody.innerHTML = categories.map(cat => `
                <tr>
                    <td>${cat.id}</td>
                    <td>${this.escapeHtml(cat.name)}</td>
                    <td>${categoryManager.getTaskCount(cat.id)}</td>
                    <td>${utils.formatDate(cat.createdAt)}</td>
                    <td class="actions">
                        <button class="btn-edit" onclick="ui.editCategory('${cat.id}')">编辑</button>
                        <button class="btn-delete" onclick="ui.deleteCategory('${cat.id}')">删除</button>
                    </td>
                </tr>
            `).join('');
        }
    },

    // 打开分类编辑模态框
    openCategoryModal(categoryId = null) {
        const modal = document.getElementById('category-edit-modal');
        const title = document.getElementById('category-modal-title');

        if (categoryId) {
            const category = categoryManager.getAll().find(c => c.id === categoryId);
            if (!category) return;

            title.textContent = '编辑分类';
            document.getElementById('edit-category-name').value = category.name;
            document.getElementById('edit-category-name').dataset.id = category.id;
        } else {
            title.textContent = '添加分类';
            document.getElementById('edit-category-name').value = '';
            document.getElementById('edit-category-name').dataset.id = '';
        }

        this.clearErrors();
        modal.classList.add('active');
    },

    // 编辑分类
    editCategory(id) {
        this.openCategoryModal(id);
    },

    // 保存分类
    saveCategory() {
        this.clearErrors();

        const name = document.getElementById('edit-category-name').value.trim();
        const id = document.getElementById('edit-category-name').dataset.id;

        if (!name) {
            this.showFieldError('edit-category-name', '请输入分类名称');
            return;
        }

        try {
            if (id) {
                categoryManager.update(id, name);
                this.showToast('分类更新成功', 'success');
            } else {
                categoryManager.create(name);
                this.showToast('分类创建成功', 'success');
            }

            this.closeModal('category-edit-modal');
            this.loadCategoryList();
            this.updateCategoryFilter();
        } catch (e) {
            this.showFieldError('edit-category-name', e.message);
        }
    },

    // 删除分类
    deleteCategory(id) {
        this.showConfirm('确定要删除这个分类吗？相关任务将变为未分类。', () => {
            try {
                categoryManager.delete(id);
                this.showToast('分类已删除', 'success');
                this.loadCategoryList();
                this.updateCategoryFilter();
            } catch (e) {
                this.showToast(e.message, 'error');
            }
        });
    },

    // 加载系统信息
    loadSystemInfo() {
        const users = storage.get(CONFIG.USERS_KEY) || [];
        const tasks = storage.get(CONFIG.TASKS_KEY) || [];

        document.getElementById('system-user-count').textContent = users.length;
        document.getElementById('system-task-count').textContent = tasks.length;
    },

    // 显示确认对话框
    showConfirm(message, callback) {
        this.confirmCallback = callback;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').classList.add('active');
    },

    // 关闭模态框
    closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    },

    // 显示Toast提示
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // HTML转义
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ==================== 初始化应用 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 初始化认证
    auth.init();
    
    // 初始化UI
    ui.init();
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    ui.showToast('发生错误，请刷新页面重试', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
    ui.showToast('发生错误，请刷新页面重试', 'error');
});
