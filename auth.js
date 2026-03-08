// Register
function register() {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!name || !email || !password) {
        showToast("Fill all fields", "error");
        return;
    }

    const user = { name, email, password };
    localStorage.setItem("mindmate_user", JSON.stringify(user));
    showToast("Account created successfully", "success");
    window.location.href = "login.html";
}

// Login
function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const storedUser = JSON.parse(localStorage.getItem("mindmate_user"));

    if (!storedUser || storedUser.email !== email || storedUser.password !== password) {
        showToast("Invalid credentials", "error");
        return;
    }
    showToast("Login successful", "success");
    localStorage.setItem("loggedInUser", storedUser.name);
    window.location.href = "dashboard.html";
}

// Logout
function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
}
