// --- 1. CONFIGURATION & DONNÉES ---
const fauxDB = ["Lait", "Pain", "Pommes", "Œufs", "Eau", "Poulet", "Pâtes", "Riz", "Savon", "Shampoing"];

let appData = JSON.parse(localStorage.getItem('appData')) || {
    currentListId: 1,
    lists: [
        { id: 1, name: "Ma Liste Locale", code: null, items: [] }
    ]
};

function getCurrentList() {
    return appData.lists.find(l => l.id == appData.currentListId);
}

function saveData() {
    localStorage.setItem('appData', JSON.stringify(appData));
}

// --- 2. CONNEXION WEBSOCKET ---
const socket = new WebSocket('ws://vps-68dd112e.vps.ovh.net:8887');

socket.addEventListener('open', () => {
    console.log("Connecté au serveur !");
    checkAndJoinRoom();
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'sync') {
        const currentList = getCurrentList();
        if (currentList && currentList.code) {
            currentList.items = data.items;
            saveData();
            renderList();
        }
    } 
    else if (data.type === 'codeGenerated') {
        const currentList = getCurrentList();
        currentList.code = data.code;
        saveData();
        
        document.getElementById('share-code-display').textContent = data.code;
        document.getElementById('modal-share').showModal();
        renderHeader();
        
        checkAndJoinRoom();
        broadcastUpdate();
    }
});

function checkAndJoinRoom() {
    if (socket.readyState === WebSocket.OPEN) {
        const currentList = getCurrentList();
        if (currentList && currentList.code) {
            socket.send(JSON.stringify({ action: "join", code: currentList.code }));
        }
    }
}

function broadcastUpdate() {
    if (socket.readyState === WebSocket.OPEN) {
        const currentList = getCurrentList();
        if (currentList && currentList.code) {
            socket.send(JSON.stringify({ action: "update", code: currentList.code, items: currentList.items }));
        }
    }
}

// --- 3. GESTION DE L'EN-TÊTE ET DES LISTES ---
const listSelector = document.getElementById('list-selector');
const btnShare = document.getElementById('btn-share');

function renderHeader() {
    listSelector.innerHTML = '';
    appData.lists.forEach(list => {
        const option = document.createElement('option');
        option.value = list.id;
        option.textContent = (list.code ? "🔗 " : "") + list.name;
        if (list.id == appData.currentListId) {
            option.selected = true;
        }
        listSelector.appendChild(option);
    });

    const currentList = getCurrentList();
    if (currentList.code) {
        btnShare.textContent = "Code: " + currentList.code;
        btnShare.style.background = "#888";
    } else {
        btnShare.textContent = "Partager";
        btnShare.style.background = "var(--primary)";
    }
}

listSelector.addEventListener('change', (e) => {
    appData.currentListId = parseInt(e.target.value);
    saveData();
    renderHeader();
    renderList();
    checkAndJoinRoom();
});

btnShare.addEventListener('click', () => {
    const currentList = getCurrentList();
    if (currentList.code) {
        document.getElementById('share-code-display').textContent = currentList.code;
        document.getElementById('modal-share').showModal();
    } else {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: "generateCode" }));
        } else {
            alert("Serveur déconnecté, impossible de partager.");
        }
    }
});

// --- 4. MODALES : NOUVELLE LISTE ET REJOINDRE ---
const modalNewList = document.getElementById('modal-new-list');
const modalJoinList = document.getElementById('modal-join-list');
const modalShare = document.getElementById('modal-share');

document.getElementById('btn-new-list').addEventListener('click', () => modalNewList.showModal());
document.getElementById('btn-close-new-list').addEventListener('click', () => modalNewList.close());

document.getElementById('btn-confirm-new-list').addEventListener('click', () => {
    const name = document.getElementById('new-list-name').value.trim();
    if (name) {
        const newId = Date.now();
        appData.lists.push({ id: newId, name: name, code: null, items: [] });
        appData.currentListId = newId;
        saveData();
        renderHeader();
        renderList();
        document.getElementById('new-list-name').value = '';
        modalNewList.close();
    }
});

document.getElementById('btn-join-list').addEventListener('click', () => modalJoinList.showModal());
document.getElementById('btn-close-join-list').addEventListener('click', () => modalJoinList.close());

document.getElementById('btn-confirm-join').addEventListener('click', () => {
    const code = document.getElementById('join-list-code').value.trim().toUpperCase();
    if (code) {
        const newId = Date.now();
        appData.lists.push({ id: newId, name: "Liste " + code, code: code, items: [] });
        appData.currentListId = newId;
        saveData();
        renderHeader();
        renderList();
        checkAndJoinRoom(); 
        document.getElementById('join-list-code').value = '';
        modalJoinList.close();
    }
});

document.getElementById('btn-close-share').addEventListener('click', () => modalShare.close());


// --- 5. AFFICHAGE DE LA LISTE PRINCIPALE ---
const listContainer = document.getElementById('shopping-list');

function saveAndRender() {
    saveData();
    renderList();
    broadcastUpdate();
}

function renderList() {
    listContainer.innerHTML = '';
    const currentList = getCurrentList();
    if (!currentList) return; 
    
    const items = currentList.items || [];

    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = `list-item ${item.checked ? 'checked' : ''}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = item.checked;
        checkbox.style.transform = "scale(1.5)";
        checkbox.addEventListener('change', () => {
            item.checked = checkbox.checked;
            saveAndRender();
        });

        const spanName = document.createElement('span');
        spanName.className = 'item-name';
        spanName.textContent = item.name;

        const spanQty = document.createElement('span');
        spanQty.className = 'item-qty';
        spanQty.textContent = `x${item.qty}`;

        const btnDelete = document.createElement('button');
        btnDelete.textContent = "🗑️";
        btnDelete.style.background = "none";
        btnDelete.style.border = "none";
        btnDelete.style.fontSize = "18px";
        btnDelete.style.cursor = "pointer";
        btnDelete.addEventListener('click', () => {
            getCurrentList().items.splice(index, 1);
            saveAndRender();
        });

        li.appendChild(checkbox);
        li.appendChild(spanName);
        li.appendChild(spanQty);
        li.appendChild(btnDelete);
        listContainer.appendChild(li);
    });
}

// --- 6. MODALE DE RECHERCHE & AJOUT ---
const modalSearch = document.getElementById('modal-search');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const customAddContainer = document.getElementById('custom-add-container');
const btnAddCustom = document.getElementById('btn-add-custom');
const customWord = document.getElementById('custom-word');
const customQty = document.getElementById('custom-qty');

function addItemToList(name, qtyToAdd) {
    const currentList = getCurrentList();
    if (!currentList.items) currentList.items = [];
    
    const existingItem = currentList.items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existingItem) {
        existingItem.qty += qtyToAdd;
    } else {
        currentList.items.push({ name: name, qty: qtyToAdd, checked: false });
    }
    saveAndRender();
    modalSearch.close();
}

function renderSearchResults(query = "") {
    searchResults.innerHTML = '';
    const filtered = fauxDB.filter(item => item.toLowerCase().includes(query.toLowerCase()));
    
    filtered.forEach(item => {
        const li = document.createElement('li');
        li.className = 'search-item';
        
        const spanName = document.createElement('span');
        spanName.textContent = item;
        spanName.style.flex = "1";
        spanName.style.alignSelf = "center";
        
        const actionDiv = document.createElement('div');
        actionDiv.className = 'search-actions';
        
        const inputQty = document.createElement('input');
        inputQty.type = 'number';
        inputQty.min = '1';
        inputQty.value = '1';
        inputQty.className = 'input-qty';
        
        const btnAdd = document.createElement('button');
        btnAdd.textContent = "+";
        btnAdd.className = "btn-add-item";
        
        btnAdd.addEventListener('click', () => {
            const qty = parseInt(inputQty.value) || 1;
            addItemToList(item, qty);
        });
        
        actionDiv.appendChild(inputQty);
        actionDiv.appendChild(btnAdd);
        
        li.appendChild(spanName);
        li.appendChild(actionDiv);
        searchResults.appendChild(li);
    });

    if (query.trim() !== "" && !fauxDB.some(item => item.toLowerCase() === query.toLowerCase())) {
        customAddContainer.classList.remove('hidden');
        customWord.textContent = query;
        customQty.value = 1;
    } else {
        customAddContainer.classList.add('hidden');
    }
}

document.getElementById('btn-add').addEventListener('click', () => {
    searchInput.value = '';
    renderSearchResults();
    modalSearch.showModal();
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalSearch.close();
});

searchInput.addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
});

btnAddCustom.addEventListener('click', () => {
    const qty = parseInt(customQty.value) || 1;
    addItemToList(searchInput.value.trim(), qty);
});

// --- 7. TERMINER LES COURSES (Modale de confirmation) ---
const modalConfirm = document.getElementById('modal-confirm');
document.getElementById('btn-finish').addEventListener('click', () => modalConfirm.showModal());
document.getElementById('btn-cancel-reset').addEventListener('click', () => modalConfirm.close());

document.getElementById('btn-confirm-reset').addEventListener('click', () => {
    getCurrentList().items = [];
    saveAndRender();
    modalConfirm.close();
});

// Initialisation au chargement
renderHeader();
renderList();

// --- 8. SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker enregistré !', reg))
            .catch(err => console.log('Échec du Service Worker', err));
    });
}
