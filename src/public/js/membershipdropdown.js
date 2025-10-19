// Select all collapse elements
document.querySelectorAll(".collapse").forEach((collapseElement) => {
  const button = collapseElement.previousElementSibling.querySelector("button");
  const arrow = button.querySelector(".arrow-icon");

  collapseElement.addEventListener("show.bs.collapse", () => {
    arrow.classList.add("arrow-rotate");
  });

  collapseElement.addEventListener("hide.bs.collapse", () => {
    arrow.classList.remove("arrow-rotate");
  });
});
