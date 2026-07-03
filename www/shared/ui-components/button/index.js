import "./style.css";

const btnClassName = (text) => {
  return "btn--" + text;
};

export function createButton({
  label,
  variant = "primary",
  className = "",
  dataGo = "",
  size = "",
  onClick,
}) {
  const button = document.createElement("button");
  button.textContent = label;
  button.className = `btn ${variant ? btnClassName(variant) : ""} ${size ? btnClassName(size) : ""} ${className} ${dataGo != "" ? "data-go=" + dataGo : ""}`;

  if (onClick) {
    button.addEventListener("click", onClick);
  }

  return button;
}
