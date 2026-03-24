// ==================== DATABASE CLASS ====================
class BankDatabase {
    constructor() {
        this.users = this.getFromStorage('bankUsers') || [];
        this.loans = this.getFromStorage('bankLoans') || [];
        this.currentUser = this.getFromStorage('currentUser') || null;
    }

    getFromStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // ==================== USER MANAGEMENT ====================
    registerUser(userData) {
        if (this.users.some(u => u.email === userData.email)) {
            return { success: false, message: '❌ Email already registered!' };
        }

        // Validate credit score
        const creditScore = parseInt(userData.creditScore);
        if (isNaN(creditScore) || creditScore < 500 || creditScore > 700) {
            return { success: false, message: '❌ Credit score must be between 500-700!' };
        }

        const newUser = {
            id: Date.now().toString(),
            ...userData,
            creditScore: creditScore,
            createdAt: new Date().toISOString(),
            totalBorrowed: 0,
            activeLoans: 0,
            completedLoans: 0,
            profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.firstName}`
        };

        this.users.push(newUser);
        this.saveToStorage('bankUsers', this.users);
        return { success: true, message: `✅ Account created successfully! Your credit score: ${creditScore}`, user: newUser };
    }

    loginUser(email, password) {
        const user = this.users.find(u => u.email === email && u.password === password);
        if (!user) {
            return { success: false, message: '❌ Invalid email or password!' };
        }

        this.currentUser = user;
        this.saveToStorage('currentUser', this.currentUser);
        return { success: true, message: '✅ Login successful!', user };
    }

    logoutUser() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    updateProfile(updates) {
        if (!this.currentUser) return false;

        const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex === -1) return false;

        this.users[userIndex] = { ...this.users[userIndex], ...updates };
        this.currentUser = this.users[userIndex];

        this.saveToStorage('bankUsers', this.users);
        this.saveToStorage('currentUser', this.currentUser);
        return true;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    // ==================== LOAN MANAGEMENT ====================
    submitLoanApplication(loanData) {
        if (!this.currentUser) {
            return { success: false, message: 'User not logged in' };
        }

        const newLoan = {
            id: Date.now().toString(),
            userId: this.currentUser.id,
            ...loanData,
            createdAt: new Date().toISOString(),
            status: 'processing',
            approvalDate: null,
            interestRate: this.calculateInterestRate(loanData.loanAmount),
            monthlyPayment: 0
        };

        // Calculate monthly payment
        newLoan.monthlyPayment = this.calculateMonthlyPayment(
            parseFloat(loanData.loanAmount),
            parseInt(loanData.loanTerm),
            newLoan.interestRate
        );

        // AUTO-APPROVAL LOGIC
        const approvalResult = this.autoApproveLoan(newLoan);
        newLoan.status = approvalResult.status;
        newLoan.approvalDate = approvalResult.status === 'approved' ? new Date().toISOString() : null;
        newLoan.approvalReason = approvalResult.reason;

        // Update user stats if approved
        if (approvalResult.status === 'approved') {
            const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
            if (userIndex !== -1) {
                this.users[userIndex].activeLoans = (this.users[userIndex].activeLoans || 0) + 1;
                this.users[userIndex].totalBorrowed = (this.users[userIndex].totalBorrowed || 0) + parseFloat(loanData.loanAmount);
                this.saveToStorage('bankUsers', this.users);
                this.currentUser = this.users[userIndex];
                this.saveToStorage('currentUser', this.currentUser);
            }
        }

        this.loans.push(newLoan);
        this.saveToStorage('bankLoans', this.loans);

        return { 
            success: true, 
            loan: newLoan,
            approved: approvalResult.status === 'approved'
        };
    }

    autoApproveLoan(loanData) {
        const user = this.currentUser;
        const amount = parseFloat(loanData.loanAmount);
        const income = parseFloat(user.annualIncome);
        const creditScore = user.creditScore || 650;

        console.log('Approval Check:', {
            creditScore,
            income,
            amount,
            loanTerm: loanData.loanTerm
        });

        // MAIN APPROVAL LOGIC BASED ON CREDIT SCORE
        // Credit Score < 600 = REJECTED (Low Score)
        // Credit Score >= 600 = APPROVED (Good/Excellent Score)

        let reasons = [];
        let canApprove = true;

        // Check monthly debt-to-income ratio
        const monthlyIncome = income / 12;
        const monthlyPayment = this.calculateMonthlyPayment(
            amount,
            parseInt(loanData.loanTerm),
            5.5
        );

        const debtToIncomeRatio = monthlyPayment / monthlyIncome;

        // PRIMARY DECISION BASED ON CREDIT SCORE
        if (creditScore < 600) {
            // Low credit score = REJECT
            canApprove = false;
            reasons.push(`❌ Credit Score ${creditScore} is below acceptable level (need 600+)`);
        } else if (creditScore >= 600) {
            // Good credit score = likely APPROVE
            // But still check other factors
            
            if (debtToIncomeRatio > 0.5) {
                canApprove = false;
                reasons.push('❌ Monthly payment exceeds 50% of your income');
            }

            if (amount > income * 5) {
                canApprove = false;
                reasons.push('❌ Loan amount exceeds maximum limit (max: 5x annual income)');
            }

            if (income < 20000) {
                canApprove = false;
                reasons.push('❌ Annual income below minimum requirement ($20,000)');
            }
        }

        // Check age requirement
        const age = this.calculateAge(user.dateOfBirth);
        if (age < 18 || age > 80) {
            canApprove = false;
            reasons.push('❌ Age requirement not met (18-80 years)');
        }

        return {
            status: canApprove ? 'approved' : 'rejected',
            reason: canApprove ? '✅ All criteria met - Loan Approved!' : reasons.join(', '),
            creditScore: creditScore,
            income: income
        };
    }

    getUserLoans() {
        if (!this.currentUser) return [];
        return this.loans.filter(l => l.userId === this.currentUser.id);
    }

    calculateInterestRate(amount) {
        if (amount >= 100000) return 4.5;
        if (amount >= 50000) return 5.0;
        if (amount >= 25000) return 5.5;
        return 6.5;
    }

    calculateMonthlyPayment(principal, months, annualRate) {
        const monthlyRate = annualRate / 100 / 12;
        if (monthlyRate === 0) return principal / months;
        return (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) / 
               (Math.pow(1 + monthlyRate, months) - 1);
    }

    calculateAge(dateString) {
        const birthDate = new Date(dateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
}

// Initialize Database
const db = new BankDatabase();

// ==================== GLOBAL HELPER FUNCTIONS ====================
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    field.type = field.type === 'password' ? 'text' : 'password';
}

function navigateToSignup() {
    window.location.href = 'signup.html';
}

function navigateToLogin() {
    window.location.href = 'index.html';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutNotification 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutNotification {
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==================== LOGIN PAGE ====================
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

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

// ==================== SIGNUP PAGE ====================
if (document.getElementById('signupForm')) {
    const passwordInput = document.getElementById('signupPassword');
    const creditScoreInput = document.getElementById('creditScore');
    const creditScoreSlider = document.getElementById('creditScoreSlider');
    const sliderValue = document.getElementById('sliderValue');

    // Sync credit score input and slider
    if (creditScoreInput && creditScoreSlider) {
        creditScoreInput.addEventListener('input', function() {
            const value = Math.max(500, Math.min(700, parseInt(this.value) || 500));
            creditScoreSlider.value = value;
            sliderValue.textContent = value;
            this.value = value;
        });

        creditScoreSlider.addEventListener('input', function() {
            creditScoreInput.value = this.value;
            sliderValue.textContent = this.value;
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strengthBar = document.getElementById('strengthBar');
            const strengthText = document.getElementById('strengthText');
            let strength = 'weak';

            if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
                strength = 'strong';
            } else if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
                strength = 'medium';
            }

            strengthBar.className = `strength-bar ${strength}`;
            strengthText.textContent = strength.charAt(0).toUpperCase() + strength.slice(1);
        });
    }

    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('signupEmail').value;
        const phone = document.getElementById('phone').value;
        const dateOfBirth = document.getElementById('dateOfBirth').value;
        const idNumber = document.getElementById('idNumber').value;
        const annualIncome = document.getElementById('annualIncome').value;
        const employment = document.getElementById('employment').value;
        const creditScore = document.getElementById('creditScore').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (password !== confirmPassword) {
            showNotification('❌ Passwords do not match!', 'error');
            return;
        }

        if (password.length < 8) {
            showNotification('❌ Password must be at least 8 characters!', 'error');
            return;
        }

        const creditScoreNum = parseInt(creditScore);
        if (isNaN(creditScoreNum) || creditScoreNum < 500 || creditScoreNum > 700) {
            showNotification('❌ Credit score must be between 500-700!', 'error');
            return;
        }

        const userData = {
            firstName,
            lastName,
            email,
            phone,
            dateOfBirth,
            idNumber,
            annualIncome: parseFloat(annualIncome),
            employment,
            creditScore: creditScoreNum,
            password
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

// ==================== DASHBOARD INITIALIZATION ====================
function initializeDashboard() {
    const user = db.getCurrentUser();
    
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Set user info
    const now = new Date().getHours();
    const greeting = now < 12 ? 'Good Morning' : now < 18 ? 'Good Afternoon' : 'Good Evening';
    
    document.getElementById('greetingText').textContent = `${greeting}, ${user.firstName}! 👋`;
    document.getElementById('userName').textContent = user.firstName + ' ' + user.lastName;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('profileAvatar').src = user.profileImage;
    document.getElementById('creditScore').textContent = user.creditScore;

    // Load overview
    loadDashboardOverview();
}

if (document.querySelector('.dashboard-page')) {
    initializeDashboard();
}

// ==================== SECTION MANAGEMENT ====================
function showSection(sectionId, event) {
    if (event) {
        event.preventDefault();
    }

    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active from menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }

    // Add active to clicked menu item
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Load data
    if (sectionId === 'overview') {
        loadDashboardOverview();
    } else if (sectionId === 'myloans') {
        loadUserLoans();
    } else if (sectionId === 'profile') {
        loadProfileForm();
    }
}

// ==================== OVERVIEW SECTION ====================
function loadDashboardOverview() {
    const user = db.getCurrentUser();
    if (!user) return;

    const userLoans = db.getUserLoans();
    const activeLoans = userLoans.filter(l => l.status === 'approved').length;
    const completedLoans = userLoans.filter(l => l.status === 'completed').length;
    const totalBorrowed = userLoans
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + parseFloat(l.loanAmount), 0);

    document.getElementById('totalBorrowed').textContent = '$' + totalBorrowed.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('activeLoans').textContent = activeLoans;
    document.getElementById('completedLoans').textContent = completedLoans;
    document.getElementById('creditScore').textContent = user.creditScore;

    // Update activity table
    const tbody = document.getElementById('activityBody');
    if (userLoans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">No loans yet</td></tr>';
    } else {
        tbody.innerHTML = userLoans.slice(-5).reverse().map(loan => `
            <tr>
                <td>${new Date(loan.createdAt).toLocaleDateString()}</td>
                <td>${getLoanTypeEmoji(loan.loanPurpose)} ${loan.loanPurpose}</td>
                <td>$${parseFloat(loan.loanAmount).toLocaleString()}</td>
                <td><span class="badge ${loan.status}">${loan.status.toUpperCase()}</span></td>
                <td>${loan.interestRate}%</td>
            </tr>
        `).join('');
    }
}

function getLoanTypeEmoji(type) {
    const emojis = {
        home: '🏠',
        car: '🚗',
        business: '💼',
        education: '📚',
        debt: '💳',
        medical: '🏥',
        other: '📄'
    };
    return emojis[type] || '💰';
}

// ==================== LOAN APPLICATION ====================
if (document.getElementById('loanApplicationForm')) {
    const loanAmountInput = document.getElementById('loanAmount');
    const loanAmountSlider = document.getElementById('loanAmountSlider');
    const loanTermInput = document.getElementById('loanTerm');

    // Sync amount input and slider
    if (loanAmountInput && loanAmountSlider) {
        loanAmountInput.addEventListener('input', function() {
            loanAmountSlider.value = this.value;
            updateLoanCalculation();
        });

        loanAmountSlider.addEventListener('input', function() {
            loanAmountInput.value = this.value;
            updateLoanCalculation();
        });
    }

    if (loanTermInput) {
        loanTermInput.addEventListener('change', updateLoanCalculation);
    }

    function updateLoanCalculation() {
        const amount = parseFloat(loanAmountInput.value) || 0;
        const term = parseInt(loanTermInput.value) || 12;
        
        let interestRate = 6.5;
        if (amount >= 100000) interestRate = 4.5;
        else if (amount >= 50000) interestRate = 5.0;
        else if (amount >= 25000) interestRate = 5.5;

        const monthlyPayment = db.calculateMonthlyPayment(amount, term, interestRate);
        const totalPayment = monthlyPayment * term;

        document.getElementById('monthlyPayment').textContent = '$' + monthlyPayment.toLocaleString('en-US', {minimumFractionDigits: 2});
        document.getElementById('interestRate').textContent = interestRate + '%';
        document.getElementById('totalAmount').textContent = '$' + totalPayment.toLocaleString('en-US', {minimumFractionDigits: 2});
    }

    document.getElementById('loanApplicationForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const user = db.getCurrentUser();
        if (!user) {
            showNotification('❌ Please login first!', 'error');
            return;
        }

        // Show processing message
        showNotification('⏳ Processing your application...', 'info');

        const loanData = {
            loanAmount: document.getElementById('loanAmount').value,
            loanTerm: document.getElementById('loanTerm').value,
            loanPurpose: document.getElementById('loanPurpose').value,
            employmentStatus: document.getElementById('employmentStatus').value,
            loanDescription: document.getElementById('loanDescription').value
        };

        // Simulate processing delay
        setTimeout(() => {
            const result = db.submitLoanApplication(loanData);

            if (result.success) {
                if (result.approved) {
                    // Show approval modal
                    showApprovalModal(result.loan);
                    showNotification('✅ Application Approved! Loan has been transferred.', 'success');
                } else {
                    // Show rejection modal
                    showRejectionModal(result.loan);
                    showNotification(`❌ Application Rejected`, 'error');
                }

                // Reset form
                document.getElementById('loanApplicationForm').reset();
                updateLoanCalculation();
                
                // Refresh loans after a delay
                setTimeout(() => {
                    loadUserLoans();
                }, 2000);
            } else {
                showNotification(result.message, 'error');
            }
        }, 2000);
    });
}

// ==================== MY LOANS SECTION ====================
function loadUserLoans() {
    const userLoans = db.getUserLoans();
    const container = document.getElementById('loansContainer');

    if (userLoans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No loans yet</h3>
                <p>Start by applying for your first loan</p>
                <button class="btn btn-apply" onclick="showSection('applyloan', event)">
                    Apply Now
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = userLoans.map(loan => {
        const monthlyPayment = db.calculateMonthlyPayment(
            parseFloat(loan.loanAmount),
            parseInt(loan.loanTerm),
            loan.interestRate
        );

        const progress = loan.status === 'approved' ? Math.floor(Math.random() * 100) : 0;

        return `
            <div class="loan-card">
                <div class="loan-header">
                    <h3>${getLoanTypeEmoji(loan.loanPurpose)} ${loan.loanPurpose.toUpperCase()}</h3>
                    <span class="badge ${loan.status}">${loan.status.toUpperCase()}</span>
                </div>
                <div class="loan-details">
                    <p><strong>Loan Amount:</strong> $${parseFloat(loan.loanAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                    <p><strong>Duration:</strong> ${loan.loanTerm} months</p>
                    <p><strong>Interest Rate:</strong> ${loan.interestRate}%</p>
                    <p><strong>Monthly Payment:</strong> $${monthlyPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                    <p><strong>Applied:</strong> ${new Date(loan.createdAt).toLocaleDateString()}</p>
                    ${loan.approvalDate ? `<p><strong>Approved:</strong> ${new Date(loan.approvalDate).toLocaleDateString()}</p>` : ''}
                    ${loan.status === 'rejected' ? `<p style="color: #ef4444;"><strong>Reason:</strong> ${loan.approvalReason}</p>` : ''}
                </div>
                ${loan.status === 'approved' ? `
                    <div class="loan-progress">
                        <div class="progress-bar">
                            <div class="progress" style="width: ${progress}%"></div>
                        </div>
                        <span>${progress}% Completed</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ==================== PROFILE SECTION ====================
function loadProfileForm() {
    const user = db.getCurrentUser();
    if (!user) return;

    document.getElementById('profFirstName').value = user.firstName;
    document.getElementById('profLastName').value = user.lastName;
    document.getElementById('profEmail').value = user.email;
    document.getElementById('profPhone').value = user.phone;
    document.getElementById('profDOB').value = user.dateOfBirth;
    document.getElementById('profIncome').value = user.annualIncome;
    document.getElementById('profEmployment').value = user.employment;
}

if (document.getElementById('profileForm')) {
    document.getElementById('profileForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const updates = {
            firstName: document.getElementById('profFirstName').value,
            lastName: document.getElementById('profLastName').value,
            phone: document.getElementById('profPhone').value,
            dateOfBirth: document.getElementById('profDOB').value,
            annualIncome: parseFloat(document.getElementById('profIncome').value),
            employment: document.getElementById('profEmployment').value
        };

        if (db.updateProfile(updates)) {
            showNotification('✅ Profile updated successfully!', 'success');
        } else {
            showNotification('❌ Failed to update profile!', 'error');
        }
    });
}

// ==================== APPROVAL MODAL ====================
function showApprovalModal(loan) {
    const monthlyPayment = db.calculateMonthlyPayment(
        parseFloat(loan.loanAmount),
        parseInt(loan.loanTerm),
        loan.interestRate
    );

    const totalPayment = monthlyPayment * parseInt(loan.loanTerm);
    const totalInterest = totalPayment - parseFloat(loan.loanAmount);
    const user = db.getCurrentUser();

    const approvalContent = `
        <div class="modal" id="approvalModal" style="display: block;">
            <div class="modal-content approval-modal">
                <div class="approval-animation">
                    <div class="checkmark">
                        <div class="checkmark-circle"></div>
                        <div class="checkmark-check"></div>
                    </div>
                </div>
                <h2>🎉 Loan Approved!</h2>
                <p>Congratulations! Your loan application has been automatically approved.</p>
                
                <div class="approval-details">
                    <h3>Loan Summary</h3>
                    <p>
                        <span><strong>Loan Type:</strong></span>
                        <span>${getLoanTypeEmoji(loan.loanPurpose)} ${loan.loanPurpose.toUpperCase()}</span>
                    </p>
                    <p>
                        <span><strong>Loan Amount:</strong></span>
                        <span>$${parseFloat(loan.loanAmount).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </p>
                    <p>
                        <span><strong>Your Credit Score:</strong></span>
                        <span style="color: var(--primary-green); font-weight: bold;">${user.creditScore} ⭐</span>
                    </p>
                    <p>
                        <span><strong>Your Annual Income:</strong></span>
                        <span>$${user.annualIncome.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </p>
                    <p>
                        <span><strong>Interest Rate:</strong></span>
                        <span>${loan.interestRate}%</span>
                    </p>
                    <p>
                        <span><strong>Loan Term:</strong></span>
                        <span>${loan.loanTerm} months</span>
                    </p>
                    <p>
                        <span><strong>Monthly Payment:</strong></span>
                        <span style="color: var(--primary-green); font-weight: bold;">$${monthlyPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </p>
                    <hr>
                    <p>
                        <span><strong>Total Interest:</strong></span>
                        <span>$${totalInterest.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </p>
                    <p>
                        <span><strong>Total to Pay:</strong></span>
                        <span style="color: var(--text-dark); font-weight: bold;">$${totalPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </p>
                </div>

                <div class="approval-info">
                    <h4>✅ What's Next?</h4>
                    <ul>
                        <li>✓ Funds will be transferred within 24 hours</li>
                        <li>✓ Check your email for loan documents</li>
                        <li>✓ First payment due on ${new Date(new Date(loan.approvalDate).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
                        <li>✓ Manage loan from "My Loans" section</li>
                    </ul>
                </div>

                <button type="button" class="btn btn-approve-ok" onclick="closeApprovalModal()">
                    <i class="fas fa-check-circle"></i> View My Loans
                </button>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('approvalModal');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', approvalContent);
    
    const modal = document.getElementById('approvalModal');
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeApprovalModal();
        }
    });
}

// ==================== REJECTION MODAL ====================
function showRejectionModal(loan) {
    const user = db.getCurrentUser();

    const rejectionContent = `
        <div class="modal" id="rejectionModal" style="display: block;">
            <div class="modal-content rejection-modal">
                <div style="font-size: 80px; margin-bottom: 20px; color: #ef4444; text-align: center;">
                    ⚠️
                </div>
                <h2 style="color: #ef4444; text-align: center;">Application Not Approved</h2>
                <p style="color: var(--text-light); text-align: center; margin-bottom: 25px;">
                    Unfortunately, your loan application could not be approved at this time.
                </p>
                
                <div class="rejection-info">
                    <h4>Reason for Rejection:</h4>
                    <p>${loan.approvalReason}</p>
                    <hr>
                    <div class="reason-details">
                        <p><strong>Your Credit Score:</strong> <span style="color: ${user.creditScore < 600 ? '#ef4444' : 'var(--primary-green)'}">${user.creditScore}</span> ${user.creditScore < 600 ? '⚠️ (Below 600)' : '✓'}</p>
                        <p><strong>Your Annual Income:</strong> $${user.annualIncome.toLocaleString('en-US')}</p>
                    </div>
                </div>

                <div class="next-steps">
                    <h4>💡 How to Improve Your Chances:</h4>
                    <ul>
                        ${user.creditScore < 600 ? '<li>📈 Improve your credit score to 600+</li>' : ''}
                        <li>💰 Request a smaller loan amount</li>
                        <li>📊 Increase your annual income</li>
                        <li>📞 Contact our support team for assistance</li>
                    </ul>
                </div>

                <button type="button" class="btn btn-primary" onclick="closeRejectionModal()">
                    <i class="fas fa-home"></i> Back to Dashboard
                </button>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('rejectionModal');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', rejectionContent);
    
    const modal = document.getElementById('rejectionModal');
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeRejectionModal();
        }
    });
}

function closeApprovalModal() {
    const modal = document.getElementById('approvalModal');
    if (modal) {
        modal.style.animation = 'fadeOutModal 0.3s ease-out';
        setTimeout(() => {
            modal.remove();
            showSection('myloans', null);
        }, 300);
    }
}

function closeRejectionModal() {
    const modal = document.getElementById('rejectionModal');
    if (modal) {
        modal.style.animation = 'fadeOutModal 0.3s ease-out';
        setTimeout(() => {
            modal.remove();
            showSection('applyloan', null);
        }, 300);
    }
}

// ==================== PASSWORD MODAL ====================
function openPasswordModal() {
    document.getElementById('passwordModal').style.display = 'block';
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
}

if (document.getElementById('changePasswordForm')) {
    document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const user = db.getCurrentUser();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (user.password !== currentPassword) {
            showNotification('❌ Current password is incorrect!', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('❌ Passwords do not match!', 'error');
            return;
        }

        if (newPassword.length < 8) {
            showNotification('❌ Password must be at least 8 characters!', 'error');
            return;
        }

        db.updateProfile({ password: newPassword });
        showNotification('✅ Password changed successfully!', 'success');
        closePasswordModal();
        this.reset();
    });
}

function enable2FA() {
    showNotification('✅ Two-Factor Authentication enabled!', 'success');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        db.logoutUser();
        showNotification('👋 Logout successful!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }
}

// ==================== MODAL CLOSE ON CLICK OUTSIDE ====================
window.addEventListener('click', function(event) {
    const passwordModal = document.getElementById('passwordModal');

    if (passwordModal && event.target === passwordModal) {
        closePasswordModal();
    }
});

// ==================== PREVENT BACK BUTTON AFTER LOGIN ====================
window.addEventListener('load', function() {
    if (document.querySelector('.dashboard-page')) {
        history.pushState(null, null, window.location.href);
        window.onpopstate = function() {
            history.go(1);
        };
    }
});

// Add fadeOutModal animation
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    @keyframes fadeOutModal {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
`;
document.head.appendChild(additionalStyles);