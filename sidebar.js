const sidebarAvatar = document.getElementById("sidebarAvatar");
const sidebarName = document.getElementById("sidebarName");

const user = JSON.parse(localStorage.getItem("mindmate_user"));
const avatar = localStorage.getItem("mindmate_avatar");

if (sidebarName) {
    sidebarName.innerText = user?.name || "User";
}

if (sidebarAvatar) {

    if (avatar) {
        sidebarAvatar.src = avatar;
    } else {
        sidebarAvatar.src =
            "https://ui-avatars.com/api/?name=" +
            (user?.name || "User") +
            "&background=8b7cf6&color=fff";
    }
}