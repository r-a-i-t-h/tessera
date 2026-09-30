import "@r-a-i-t-h/tessera-skin-w3/w3.css";
import "@r-a-i-t-h/tessera-skin-w3/w3-theme-teal.css";
import "@r-a-i-t-h/tessera-skin-w3/chrome.css";
import "./app.css";
import { mount } from "./app";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");
await mount(root);
