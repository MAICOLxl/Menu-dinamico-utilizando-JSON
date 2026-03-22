const STORAGE_KEY = "dynamic-menu-data";
const DEFAULT_DATA = {
  menu: [
    { id: 1, nombre: "Inicio", enlace: "/inicio", icono: "HOME" },
    { id: 2, nombre: "Sobre Nosotros", enlace: "/sobre-nosotros", icono: "INFO" },
    { id: 3, nombre: "Servicios", enlace: "#", icono: "SERV" },
    { id: 4, nombre: "Desarrollo Web", enlace: "/servicios/web", parentId: 3, icono: "WEB" },
    { id: 5, nombre: "Soporte", enlace: "/servicios/soporte", parentId: 3, icono: "HELP" },
    { id: 6, nombre: "Contacto", enlace: "/contacto", icono: "MAIL" }
  ]
};

const $ = (selector) => document.querySelector(selector);

const form = $("#menu-form");
const menuList = $("#menu-list");
const preview = $("#json-preview");
const message = $("#form-message");
const source = $("#data-source");
const editId = $("#edit-id");
const itemId = $("#item-id");
const itemName = $("#item-name");
const itemLink = $("#item-link");
const itemIcon = $("#item-icon");
const itemParent = $("#item-parent");

let menu = [];

start();

async function start() {
  form.addEventListener("submit", saveItem);
  $("#cancel-edit").addEventListener("click", clearForm);
  $("#reset-storage").addEventListener("click", resetData);
  $("#file-input").addEventListener("change", importJson);
  $("#export-json").addEventListener("click", exportJson);

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      validateData(data);
      menu = data.menu;
      draw();
      source.textContent = "Datos cargados desde localStorage.";
      return;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  try {
    const response = await fetch("menu-data.json");
    const data = await response.json();
    validateData(data);
    menu = data.menu;
    saveLocal();
    source.textContent = "Datos cargados desde menu-data.json.";
  } catch {
    menu = DEFAULT_DATA.menu;
    saveLocal();
    source.textContent = "No se pudo leer el archivo JSON. Se usaron datos por defecto.";
  }

  draw();
}

function draw() {
  menuList.innerHTML = "";
  createList(null).forEach((li) => menuList.appendChild(li));
  preview.textContent = JSON.stringify({ menu }, null, 2);
}

function createList(parentId) {
  return menu
    .filter((item) => (item.parentId || null) === parentId)
    .sort((a, b) => a.id - b.id)
    .map((item) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      const edit = document.createElement("button");
      const remove = document.createElement("button");
      const children = createList(item.id);

      link.href = item.enlace;
      link.textContent = item.icono ? `${item.icono} ${item.nombre}` : item.nombre;
      if (/^https?:\/\//i.test(item.enlace)) {
        link.target = "_blank";
        link.rel = "noreferrer noopener";
      }

      edit.type = "button";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => loadForm(item));

      remove.type = "button";
      remove.textContent = "Eliminar";
      remove.addEventListener("click", () => removeItem(item.id));

      li.append(link, document.createTextNode(" "), edit, document.createTextNode(" "), remove);

      if (children.length) {
        const ul = document.createElement("ul");
        children.forEach((child) => ul.appendChild(child));
        li.appendChild(ul);
      }

      return li;
    });
}

function saveItem(event) {
  event.preventDefault();

  const id = Number(itemId.value);
  const parentId = itemParent.value ? Number(itemParent.value) : null;
  const newItem = {
    id,
    nombre: clean(itemName.value),
    enlace: itemLink.value.trim(),
    icono: clean(itemIcon.value).slice(0, 8)
  };

  if (parentId) {
    newItem.parentId = parentId;
  }

  try {
    validate(newItem);

    if (editId.value) {
      const currentId = Number(editId.value);
      menu = menu.map((item) => item.id === currentId ? newItem : item);
      menu = menu.map((item) => item.parentId === currentId ? { ...item, parentId: id } : item);
      show(`Opcion ${newItem.nombre} actualizada.`);
    } else {
      menu.push(newItem);
      show(`Opcion ${newItem.nombre} agregada.`);
    }

    saveLocal();
    draw();
    clearForm();
  } catch (error) {
    show(error.message);
  }
}

function validate(item) {
  if (!Number.isInteger(item.id) || item.id < 1) {
    throw new Error("El ID debe ser un numero entero positivo.");
  }

  if (!item.nombre) {
    throw new Error("El nombre es obligatorio.");
  }

  validateLink(item.enlace);

  const repeated = menu.some((entry) => entry.id === item.id && entry.id !== Number(editId.value || 0));
  if (repeated) {
    throw new Error("El ID ya existe.");
  }

  if (item.parentId != null) {
    if (item.parentId === item.id) {
      throw new Error("Una opcion no puede ser su propio padre.");
    }

    if (!menu.some((entry) => entry.id === item.parentId || entry.id === Number(editId.value || 0))) {
      throw new Error("El ID padre no existe.");
    }

    if (hasCycle(item)) {
      throw new Error("La relacion padre-hijo no es valida.");
    }
  }
}

function validateData(data) {
  if (!data || !Array.isArray(data.menu)) {
    throw new Error("El JSON debe tener una propiedad menu.");
  }

  const ids = new Set();
  data.menu.forEach((item) => {
    if (ids.has(item.id)) {
      throw new Error("Hay IDs duplicados en el JSON.");
    }
    ids.add(item.id);
    validateLink(String(item.enlace || ""));
  });
}

function validateLink(link) {
  const simple = /^(\/|#)[\w\-./#?=&%]*$/;
  if (simple.test(link)) {
    return;
  }

  try {
    const url = new URL(link);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error("El enlace no es valido.");
  }
}

function hasCycle(item) {
  const currentEditId = Number(editId.value || 0);
  const testMenu = menu.filter((entry) => entry.id !== currentEditId).concat(item);
  let parentId = item.parentId;

  while (parentId != null) {
    if (parentId === item.id) {
      return true;
    }
    const parent = testMenu.find((entry) => entry.id === parentId);
    parentId = parent ? parent.parentId : null;
  }

  return false;
}

function loadForm(item) {
  editId.value = item.id;
  itemId.value = item.id;
  itemName.value = item.nombre;
  itemLink.value = item.enlace;
  itemIcon.value = item.icono || "";
  itemParent.value = item.parentId || "";
  show(`Editando ID ${item.id}.`);
}

function removeItem(id) {
  const ids = [id];

  for (let i = 0; i < ids.length; i += 1) {
    menu
      .filter((item) => item.parentId === ids[i])
      .forEach((item) => ids.push(item.id));
  }

  menu = menu.filter((item) => !ids.includes(item.id));
  saveLocal();
  draw();
  clearForm();
  show("Opcion eliminada.");
}

function clearForm() {
  form.reset();
  editId.value = "";
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ menu }));
}

function resetData() {
  menu = DEFAULT_DATA.menu.map((item) => ({ ...item }));
  saveLocal();
  draw();
  clearForm();
  show("Menu restablecido.");
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      validateData(data);
      menu = data.menu;
      saveLocal();
      draw();
      clearForm();
      show("JSON importado correctamente.");
    } catch (error) {
      show(error.message);
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ menu }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "menu-data-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function clean(text) {
  return text.trim().replace(/[<>]/g, "");
}

function show(text) {
  message.textContent = text;
}
