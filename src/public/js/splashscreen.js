document.addEventListener("DOMContentLoaded", function () {
  const splash = document.getElementById("splash-screen");

  // Keep splash for 2 seconds then fade out
  setTimeout(() => {
    splash.classList.add("fade-out");
  }, 2000);
});
