// ==================== LOCAL STORAGE / DATABASE SIMULATION ====================
class BankDatabase {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('bankUsers')) || [];
        this.loans = JSON.parse(localStorage.getItem('bankLoans')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    }

    saveUsers() {
        localStorage.setItem('bankUsers', JSON.stringify(this.users));
    }

    saveLoans() {
        localStorage.setItem('bankLoans', JSON.stringify(this.loans));
    }

    saveCurrentUser() {
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }

    registerUser(userData) {
        const userExists = this.users.some(u => u.email === userData.email);
        if (userExists) {
            return { success: false, message: 'Email already registered!' };
        }

        const newUser = {
            id: Date.now().toString(),
            ...userData,
            createdAt: new Date().toISOString(),
            creditScore: 650,
            totalBorrowed: 0,
            activeLoans: 0,
            completedLoans: 0
        };

        this.users.push(newUser);
        this.saveUsers();
        return { success: true, message: 'Account created successfully!', user: newUser };
    }

    loginUser(email, password) {
        const user = this.users.find(u => u.email === email && u.signupPassword === password);
        if (!user) {
            return { success: false, message: 'Invalid email or password!' };
        }

        this.currentUser = user;
        this.saveCurrentUser();
        return { success: true, message: 'Login successful!', user };
    }

    getCurrentUser() {
        return this.currentUser;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    addLoan(loanData) {
        const newLoan = {
            id: Date.now().toString(),
            userId: this.currentUser.id,
            ...loanData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            approvalDate: null,
            interestRate: 5.5
        };

        this.loans.push(newLoan);
        this.saveLoans();
        return newLoan;
    }

    getUserLoans(userId) {
        return this.loans.filter(loan => loan.userId === userId);
    }

    approveLoan(loanId) {
        const loan = this.loans.find(l => l.id === loanId);
        if (loan) {
            loan.status = 'approved';
            loan.approvalDate = new Date().toISOString();
            
            const user = this.users.find(u => u.id === loan.userId);
            if (user) {
                user.activeLoans = (user.activeLoans || 0) + 1;
                user.totalBorrowed = (user.totalBorrowed || 0) + parseFloat(loan.loanAmount);
                user.creditScore = Math.max(300, user.creditScore - 10);
                this.saveUsers();
            }
            
            this.saveLoans();
            return true;
        }
        return false;
    }

    updateUserProfile(userId, updates) {
        const user = this.users.find(u => u.id === userId);
        if (user) {
            Object.assign(user, updates);
            this.saveUsers();
            this.currentUser = user;
            this.saveCurrentUser();
            return true;
        }
        return false;
    }
}

// Initialize Database
const db = new BankDatabase();

// ==================== NAVIGATION FUNCTIONS ====================
function navigateToSignup() {
    window.location.href = 'signup.html';
}

function navigateToLogin() {
    window.location.href = 'index.html';
}

// ==================== LOGIN PAGE FUNCTIONS ====================
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const result = db.loginUser(email, password);

        if (result.success) {
            showNotification(result.message, 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showNotification(result.message, 'error');
        }
    });
}

// ==================== SIGNUP PAGE FUNCTIONS ====================
if (document.getElementById('signupForm')) {
    // Password strength indicator
    document.getElementById('signupPassword')?.addEventListener('input', function() {
        const password = this.value;
        const strengthElement = document.getElementById('passwordStrength');
        let strength = 'weak';

        if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
            strength = 'strong';
        } else if (password.length >= 6) {
            strength = 'medium';
        }

        strengthElement.className = 'password-strength ' + strength;
        strengthElement.textContent = strength.charAt(0).toUpperCase() + strength.slice(1) + ' Password';
    });

    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const signupEmail = document.getElementById('signupEmail').value;
        const phone = document.getElementById('phone').value;
        const idNumber = document.getElementById('idNumber').value;
        const income = document.getElementById('income').value;
        const signupPassword = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (signupPassword !== confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }

        if (signupPassword.length < 8) {
            showNotification('Password must be at least 8 characters!', 'error');
            return;
        }

        const userData = {
            firstName,
            lastName,
            email: signupEmail,
            phone,
            idNumber,
            income: parseFloat(income),
            signupPassword
        };

        const result = db.registerUser(userData);

        if (result.success) {
            showNotification(result.message, 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showNotification(result.message, 'error');
        }
    });
}

// ==================== DASHBOARD FUNCTIONS ====================
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }

    // Add active class to clicked nav item
    event.target.classList.add('active');

    // Load data if needed
    if (sectionId === 'overview') {
        loadDashboardOverview();
    } else if (sectionId === 'myloan') {
        loadUserLoans();
    } else if (sectionId === 'profile') {
        loadUserProfile();
    }
}

function loadDashboardOverview() {
    const user = db.getCurrentUser();
    if (!user) return;

    document.getElementById('totalBorrowed').textContent = '$' + (user.totalBorrowed || 0).toLocaleString();
    document.getElementById('activeLoans').textContent = user.activeLoans || 0;
    document.getElementById('completedLoans').textContent = user.completedLoans || 0;
    document.getElementById('creditScore').textContent = user.creditScore || 650;
}

function loadUserLoans() {
    const user = db.getCurrentUser();
    if (!user) return;

    const userLoans = db.getUserLoans(user.id);
    const container = document.getElementById('loansContainer');
    
    if (userLoans.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light);">No loans yet. Start by applying for one!</p>';
        return;
    }

    container.innerHTML = userLoans.map(loan => `
        <div class="loan-card">
            <div class="loan-header">
                <h3>${getLoanPurposeLabel(loan.loanPurpose)}</h3>
                <span class="badge ${loan.status}">${loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}</span>
            </div>
            <div class="loan-details">
                <p><strong>Amount:</strong> $${parseFloat(loan.loanAmount).toLocaleString()}</p>
                <p><strong>Interest Rate:</strong> ${loan.interestRate}%</p>
                <p><strong>Term:</strong> ${loan.loanTerm} months</p>
                <p><strong>Monthly Payment:</strong> $${calculateMonthlyPayment(loan.loanAmount, loan.loanTerm, loan.interestRate).toFixed(2)}</p>
                <p><strong>Status:</strong> ${loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}</p>
                <p><strong>Applied:</strong> ${new Date(loan.createdAt).toLocaleDateString()}</p>
            </div>
        </div>
    `).join('');
}

function loadUserProfile() {
    const user = db.getCurrentUser();
    if (!user) return;

    document.getElementById('profFirstName').value = user.firstName || '';
    document.getElementById('profLastName').value = user.lastName || '';
    document.getElementById('profEmail').value = user.email || '';
    document.getElementById('profPhone').value = user.phone || '';
    document.getElementById('profIncome').value = user.income || '';
    document.getElementById('profID').value = user.idNumber || '';

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const updates = {
                firstName: document.getElementById('profFirstName').value,
                lastName: document.getElementById('profLastName').value,
                phone: document.getElementById('profPhone').value,
                income: parseFloat(document.getElementById('profIncome').value)
            };

            if (db.updateUserProfile(user.id, updates)) {
                showNotification('Profile updated successfully!', 'success');
            } else {
                showNotification('Failed to update profile!', 'error');
            }
        }, { once: true });
    }
}

// Initialize dashboard
if (document.querySelector('.dashboard')) {
    const user = db.getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
    } else {
        document.getElementById('userName').textContent = user.firstName || 'User';
        document.getElementById('userEmail').textContent = user.email;
        loadDashboardOverview();
    }
}

// ==================== LOAN APPLICATION FORM ====================
if (document.getElementById('loanApplicationForm')) {
    const loanAmountInput = document.getElementById('loanAmount');
    const loanTermInput = document.getElementById('loanTerm');

    function updateLoanCalculation() {
        const amount = parseFloat(loanAmountInput.value) || 0;
        const term = parseInt(loanTermInput.value) || 1;
        const interestRate = 5.5;

        const monthlyPayment = calculateMonthlyPayment(amount, term, interestRate);
        const totalPayment = monthlyPayment * term;

        document.getElementById('monthlyPayment').textContent = '$' + monthlyPayment.toFixed(2);
        document.getElementById('interestRate').textContent = interestRate + '%';
        document.getElementById('totalPayment').textContent = '$' + totalPayment.toFixed(2);
    }

    loanAmountInput.addEventListener('input', updateLoanCalculation);
    loanTermInput.addEventListener('change', updateLoanCalculation);

    document.getElementById('loanApplicationForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const user = db.getCurrentUser();
        if (!user) {
            showNotification('Please login first!', 'error');
            return;
        }

        const loanData = {
            loanAmount: document.getElementById('loanAmount').value,
            loanTerm: document.getElementById('loanTerm').value,
            loanPurpose: document.getElementById('loanPurpose').value,
            employmentStatus: document.getElementById('employmentStatus').value,
            colateral: document.getElementById('colateral').value
        };

        const newLoan = db.addLoan(loanData);

        showNotification('Loan application submitted! Status: Pending Review', 'success');
        
        setTimeout(() => {
            document.getElementById('loanApplicationForm').reset();
        }, 1500);
    });
}

// ==================== UTILITY FUNCTIONS ====================
function calculateMonthlyPayment(principal, months, annualRate) {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    return (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) / 
           (Math.pow(1 + monthlyRate, months) - 1);
}

function getLoanPurposeLabel(purpose) {
    const purposes = {
        home: '🏠 Home Loan',
        car: '🚗 Auto Loan',
        business: '💼 Business Loan',
        education: '📚 Education Loan',
        debt: '💳 Debt Consolidation',
        other: '📄 Personal Loan'
    };
    return purposes[purpose] || 'Loan';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        font-weight: 600;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modal functions
function openChangePassword() {
    document.getElementById('passwordModal').style.display = 'block';
}

function closeChangePassword() {
    document.getElementById('passwordModal').style.display = 'none';
}

if (document.getElementById('changePasswordForm')) {
    document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        const user = db.getCurrentUser();

        if (user.signupPassword !== oldPassword) {
            showNotification('Current password is incorrect!', 'error');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showNotification('New passwords do not match!', 'error');
            return;
        }

        if (newPassword.length < 8) {
            showNotification('Password must be at least 8 characters!', 'error');
            return;
        }

        db.updateUserProfile(user.id, { signupPassword: newPassword });
        showNotification('Password changed successfully!', 'success');
        closeChangePassword();
    });
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        db.logout();
        window.location.href = 'index.html';
    }
}

// Click outside modal to close
window.addEventListener('click', function(e) {
    const modal = document.getElementById('passwordModal');
    if (modal && e.target === modal) {
        modal.style.display = 'none';
    }
});

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);