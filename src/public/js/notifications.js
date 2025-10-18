const notifBtn = document.getElementById("notifBtn");
const notifDropdown = document.getElementById("notifDropdown");

notifBtn.addEventListener("click", (e) => {
  e.preventDefault();
  notifDropdown.classList.toggle("active");
});

// Optional: close when clicking outside
document.addEventListener("click", (e) => {
  if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
    notifDropdown.classList.remove("active");
  }
});
