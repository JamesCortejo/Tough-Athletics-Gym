const saveBtn = document.getElementById("saveBtn");
const popupOverlay = document.getElementById("popupOverlay");
const noBtn = document.getElementById("noBtn");
const yesBtn = document.getElementById("yesBtn");

// Show popup when Save is clicked
saveBtn.addEventListener("click", () => {
  popupOverlay.style.display = "flex";
});

// Hide popup when No is clicked
noBtn.addEventListener("click", () => {
  popupOverlay.style.display = "none";
});

// Handle Yes button click
yesBtn.addEventListener("click", () => {
  popupOverlay.style.display = "none";
  alert("Changes saved!"); // Replace with your actual save function
});
