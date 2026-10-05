// ---------------- DATA DE SEMILLA (solo se usa una vez, si la colección está vacía) ----------------
const DEFAULT_PETS = [
  {name:"Manchas", type:"perro", size:"mediano", age:2, vax:true, sex:"Macho", origin:"Refugio Huellitas", tags:["juguetón","sociable"], desc:"Le encanta correr y jugar con niños. Ideal para familias activas.", photo:null},
  {name:"Michi", type:"gato", size:"pequeño", age:1, vax:true, sex:"Hembra", origin:"Rescatista Ana R.", tags:["tranquila","cariñosa"], desc:"Perfecta para departamentos. Le gusta dormir al sol.", photo:null},
  {name:"Rocky", type:"perro", size:"grande", age:4, vax:false, sex:"Macho", origin:"Refugio Patitas Felices", tags:["guardián","leal"], desc:"Necesita espacio para correr. Muy protector con su familia.", photo:null},
  {name:"Luna", type:"gato", size:"mediano", age:3, vax:true, sex:"Hembra", origin:"Refugio Huellitas", tags:["independiente","curiosa"], desc:"Se adapta bien a otros gatos. Le gusta explorar.", photo:null},
  {name:"Toby", type:"perro", size:"pequeño", age:6, vax:true, sex:"Macho", origin:"Rescatista Marco P.", tags:["tranquilo","cariñoso"], desc:"Perro senior, ideal como compañía tranquila para el hogar.", photo:null},
  {name:"Pepa", type:"conejo", size:"pequeño", age:1, vax:false, sex:"Hembra", origin:"Refugio Orejas Largas", tags:["dócil","curiosa"], desc:"Rescatada de una situación de abandono. Muy dulce con las personas.", photo:null},
  {name:"Simba", type:"gato", size:"grande", age:5, vax:true, sex:"Macho", origin:"Rescatista Ana R.", tags:["seguro","juguetón"], desc:"Gato grande y de carácter fuerte, ideal con dueños experimentados.", photo:null},
  {name:"Nina", type:"perro", size:"mediano", age:0.5, vax:false, sex:"Hembra", origin:"Refugio Patitas Felices", tags:["energética","curiosa"], desc:"Cachorra en pleno crecimiento, necesita paciencia y entrenamiento.", photo:null},
  {name:"Coco", type:"conejo", size:"pequeño", age:2, vax:true, sex:"Macho", origin:"Refugio Orejas Largas", tags:["tranquilo","dócil"], desc:"Vive bien en interiores, se lleva bien con otros conejos.", photo:null},
  {name:"Duna", type:"perro", size:"grande", age:3, vax:true, sex:"Hembra", origin:"Rescatista Marco P.", tags:["leal","sociable"], desc:"Muy obediente, ya sabe comandos básicos. Excelente con niños.", photo:null},
  {name:"Gris", type:"gato", size:"pequeño", age:7, vax:true, sex:"Macho", origin:"Refugio Huellitas", tags:["tranquilo","cariñoso"], desc:"Gato senior muy noble, busca un hogar tranquilo para sus últimos años.", photo:null},
  {name:"Bruno", type:"perro", size:"mediano", age:1.5, vax:true, sex:"Macho", origin:"Rescatista Ana R.", tags:["juguetón","energético"], desc:"Ideal para alguien activo que disfrute de paseos largos.", photo:null},
];

const TYPE_ICON = { perro:"🐕", gato:"🐈", conejo:"🐇" };
const TYPE_LABEL = { perro:"Perro", gato:"Gato", conejo:"Conejo" };
const SIZE_LABEL = { pequeño:"Pequeño", mediano:"Mediano", grande:"Grande" };

// `db` viene de firebase-config.js (cargado antes que este archivo)
const petsCol = db.collection('mascotas');
const applicationsCol = db.collection('postulaciones');
const metaRef = db.collection('meta').doc('seed');

// ---------------- STATE ----------------
let PETS = [];
let isAdmin = false;
let state = {
  search: "",
  types: new Set(),
  sizes: new Set(),
  maxAge: 12,
  vaxOnly: false,
};

// ---------------- FIRESTORE: SEMBRADO INICIAL ----------------
async function seedIfNeeded(){
  try{
    const seedSnap = await metaRef.get();
    if (seedSnap.exists) return;
    const batch = db.batch();
    DEFAULT_PETS.forEach(p => {
      const ref = petsCol.doc();
      batch.set(ref, { ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    batch.set(metaRef, { done: true, at: firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
  }catch(err){
    console.error("No se pudo sembrar la colección inicial", err);
  }
}

// ---------------- FIRESTORE: ESCUCHA EN TIEMPO REAL ----------------
function listenPets(){
  petsCol.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    PETS = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, err => {
    console.error("Error escuchando la colección de mascotas", err);
    document.getElementById('petGrid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1">⚠️ No se pudo conectar con Firebase.<br>Revisa tu configuración en js/firebase-config.js y las reglas de Firestore.</div>`;
  });
}

// ---------------- FILTER ALGORITHM ----------------
// Filtro dinámico multi-criterio: recorre la lista una sola vez (O(n))
// y aplica todos los criterios activos de forma acumulativa.
function filterPets(pets, s){
  const q = s.search.trim().toLowerCase();
  return pets.filter(p => {
    if (s.types.size && !s.types.has(p.type)) return false;
    if (s.sizes.size && !s.sizes.has(p.size)) return false;
    if (p.age > s.maxAge) return false;
    if (s.vaxOnly && !p.vax) return false;
    if (q){
      const haystack = (p.name + " " + (p.tags||[]).join(" ") + " " + p.desc).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ---------------- HELPERS ----------------
function ageLabel(age){
  return age < 1 ? `${Math.round(age*12)} meses` : `${age} ${age===1?'año':'años'}`;
}

function avatarHtml(p){
  if (p.photo){
    return `<div class="pet-avatar"><img src="${p.photo}" alt="Foto de ${p.name}"/></div>`;
  }
  return `<div class="pet-avatar">${TYPE_ICON[p.type]}</div>`;
}

// Redimensiona y comprime una imagen subida antes de guardarla
// (Firestore limita cada documento a 1 MiB, por eso se reduce el tamaño)
function readAndResizeImage(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 500;
        let { width, height } = img;
        if (width > height && width > maxDim){ height *= maxDim/width; width = maxDim; }
        else if (height > maxDim){ width *= maxDim/height; height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------- RENDER: CHIPS ----------------
function renderChips(){
  const typeChips = document.getElementById('typeChips');
  typeChips.innerHTML = Object.keys(TYPE_LABEL).map(t =>
    `<div class="chip" data-type="${t}">${TYPE_ICON[t]} ${TYPE_LABEL[t]}</div>`
  ).join('');
  const sizeChips = document.getElementById('sizeChips');
  sizeChips.innerHTML = Object.keys(SIZE_LABEL).map(sz =>
    `<div class="chip" data-size="${sz}">${SIZE_LABEL[sz]}</div>`
  ).join('');

  typeChips.querySelectorAll('.chip').forEach(el => el.addEventListener('click', () => {
    const t = el.dataset.type;
    state.types.has(t) ? state.types.delete(t) : state.types.add(t);
    el.classList.toggle('active');
    renderGrid();
  }));
  sizeChips.querySelectorAll('.chip').forEach(el => el.addEventListener('click', () => {
    const sz = el.dataset.size;
    state.sizes.has(sz) ? state.sizes.delete(sz) : state.sizes.add(sz);
    el.classList.toggle('active');
    renderGrid();
  }));
}

// ---------------- RENDER: GRID ----------------
function renderGrid(){
  const list = filterPets(PETS, state);
  const grid = document.getElementById('petGrid');
  document.getElementById('resultsCount').textContent = `${list.length} de ${PETS.length} fichas encontradas`;

  if (!list.length){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">🔍 Ninguna ficha coincide con tus filtros.<br>Prueba ampliando la edad o quitando algún filtro.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="pet-card" data-id="${p.id}">
      ${p.vax ? '<div class="vax-badge">✓ VACUNADO</div>' : ''}
      ${avatarHtml(p)}
      <h3>${p.name}</h3>
      <div class="pet-meta">
        <span>${TYPE_LABEL[p.type]}</span>
        <span>${SIZE_LABEL[p.size]}</span>
        <span>${ageLabel(p.age)}</span>
      </div>
      <div class="pet-tags">${(p.tags||[]).map(t=>`<span>${t}</span>`).join('')}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.pet-card').forEach(el => el.addEventListener('click', () => openFicha(el.dataset.id)));
}

function renderStats(){
  document.getElementById('statTotal').textContent = PETS.length;
  document.getElementById('statVax').textContent = PETS.filter(p=>p.vax).length;
  document.getElementById('statShelters').textContent = new Set(PETS.map(p=>p.origin)).size;
}

function render(){
  renderGrid();
  renderStats();
}

// ---------------- MODAL: FICHA ----------------
function openFicha(id){
  const p = PETS.find(x=>x.id===id);
  if(!p) return;
  const modal = document.getElementById('fichaModal');
  modal.innerHTML = `
    <button class="modal-close" onclick="closeOverlay('fichaOverlay')">✕</button>
    ${avatarHtml(p)}
    <h2 style="text-align:center;">${p.name}</h2>
    <div class="mono-sub" style="text-align:center;">${p.origin}</div>
    <div class="ficha">
      <div><b>Tipo</b>${TYPE_LABEL[p.type]}</div>
      <div><b>Tamaño</b>${SIZE_LABEL[p.size]}</div>
      <div><b>Edad</b>${ageLabel(p.age)}</div>
      <div><b>Sexo</b>${p.sex}</div>
      <div><b>Vacunas</b>${p.vax ? 'Al día ✓' : 'Pendiente'}</div>
      <div><b>Carácter</b>${(p.tags||[]).join(', ')}</div>
    </div>
    <p style="font-size:14px;color:var(--ink-soft);line-height:1.5;">${p.desc}</p>
    <button class="adopt-btn" onclick="openForm('${p.id}')">Quiero adoptar a ${p.name}</button>
    ${isAdmin ? `
    <div class="modal-actions">
      <label class="icon-btn" for="fichaPhotoInput">🖼️ Cambiar foto</label>
      <input type="file" id="fichaPhotoInput" accept="image/*" style="display:none" />
      <div class="icon-btn danger" id="deleteTrigger">🗑️ Eliminar ficha</div>
    </div>
    <div id="deleteConfirmSlot"></div>
    ` : ''}
  `;
  if (!isAdmin) { document.getElementById('fichaOverlay').classList.add('open'); return; }
  document.getElementById('fichaPhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readAndResizeImage(file);
    try{
      await petsCol.doc(id).update({ photo: dataUrl });
      openFicha(id);
    }catch(err){
      console.error("No se pudo actualizar la foto", err);
    }
  });
  document.getElementById('deleteTrigger').addEventListener('click', () => {
    document.getElementById('deleteConfirmSlot').innerHTML = `
      <div class="confirm-box">
        <p>¿Eliminar la ficha de <b>${p.name}</b>? Esta acción no se puede deshacer.</p>
        <div class="confirm-actions">
          <button class="yes" id="confirmDeleteYes">Sí, eliminar</button>
          <button class="no" id="confirmDeleteNo">Cancelar</button>
        </div>
      </div>
    `;
    document.getElementById('confirmDeleteYes').addEventListener('click', async () => {
      try{
        await petsCol.doc(id).delete();
        closeOverlay('fichaOverlay');
      }catch(err){
        console.error("No se pudo eliminar la ficha", err);
      }
    });
    document.getElementById('confirmDeleteNo').addEventListener('click', () => {
      document.getElementById('deleteConfirmSlot').innerHTML = '';
    });
  });
  document.getElementById('fichaOverlay').classList.add('open');
}

// ---------------- MODAL: AGREGAR MASCOTA ----------------
function openPetForm(){
  const modal = document.getElementById('petFormModal');
  modal.innerHTML = `
    <button class="modal-close" onclick="closeOverlay('petFormOverlay')">✕</button>
    <div class="form-title display">Agregar nueva ficha</div>
    <div class="form-sub">Registra un animal en adopción. Se guarda directamente en Firestore y aparece al instante en el catálogo.</div>
    <form id="newPetForm">
      <div class="photo-upload">
        <div class="photo-preview" id="newPetPreview">📷</div>
        <label class="upload-btn" for="newPetPhoto">Subir foto</label>
        <input type="file" id="newPetPhoto" accept="image/*" />
      </div>
      <div class="field"><label>Nombre</label><input required type="text" id="npName" /></div>
      <div class="field-row">
        <div class="field"><label>Tipo</label>
          <select id="npType">
            <option value="perro">Perro</option>
            <option value="gato">Gato</option>
            <option value="conejo">Conejo</option>
          </select>
        </div>
        <div class="field"><label>Tamaño</label>
          <select id="npSize">
            <option value="pequeño">Pequeño</option>
            <option value="mediano">Mediano</option>
            <option value="grande">Grande</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Edad (años)</label><input required type="number" step="0.5" min="0" max="20" id="npAge" value="1" /></div>
        <div class="field"><label>Sexo</label>
          <select id="npSex"><option>Macho</option><option>Hembra</option></select>
        </div>
      </div>
      <div class="field"><label>Origen (refugio o rescatista)</label><input required type="text" id="npOrigin" placeholder="Ej. Refugio Huellitas" /></div>
      <div class="field"><label>Carácter (separado por comas)</label><input required type="text" id="npTags" placeholder="juguetón, sociable" /></div>
      <div class="field"><label><input type="checkbox" id="npVax" style="width:auto;display:inline-block;margin-right:6px;" />Ya está vacunado</label></div>
      <div class="field"><label>Descripción</label><textarea required id="npDesc"></textarea></div>
      <button class="adopt-btn" type="submit">Guardar ficha</button>
    </form>
  `;
  let photoData = null;
  document.getElementById('newPetPhoto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoData = await readAndResizeImage(file);
    document.getElementById('newPetPreview').innerHTML = `<img src="${photoData}" alt="Vista previa" />`;
  });
  document.getElementById('newPetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPet = {
      name: document.getElementById('npName').value.trim(),
      type: document.getElementById('npType').value,
      size: document.getElementById('npSize').value,
      age: Number(document.getElementById('npAge').value),
      sex: document.getElementById('npSex').value,
      origin: document.getElementById('npOrigin').value.trim(),
      tags: document.getElementById('npTags').value.split(',').map(t=>t.trim()).filter(Boolean),
      vax: document.getElementById('npVax').checked,
      desc: document.getElementById('npDesc').value.trim(),
      photo: photoData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    try{
      await petsCol.add(newPet);
      closeOverlay('petFormOverlay');
    }catch(err){
      console.error("No se pudo guardar la nueva ficha", err);
    }
  });
  document.getElementById('petFormOverlay').classList.add('open');
}

// ---------------- MODAL: FORMULARIO DE ADOPCIÓN ----------------
function openForm(id){
  closeOverlay('fichaOverlay');
  const p = PETS.find(x=>x.id===id);
  const modal = document.getElementById('formModal');
  modal.innerHTML = `
    <button class="modal-close" onclick="closeOverlay('formOverlay')">✕</button>
    <div class="form-title display">Postulación para adoptar a ${p.name}</div>
    <div class="form-sub">Completa tus datos. El refugio o rescatista se pondrá en contacto contigo para coordinar una visita.</div>
    <form id="adoptForm">
      <div class="field"><label>Nombre completo</label><input required type="text" id="apName" /></div>
      <div class="field"><label>Correo electrónico</label><input required type="email" id="apEmail" /></div>
      <div class="field"><label>Teléfono</label><input required type="tel" id="apPhone" /></div>
      <div class="field"><label>Tipo de vivienda</label>
        <select required id="apHousing">
          <option value="">Selecciona…</option>
          <option>Departamento</option>
          <option>Casa con patio</option>
          <option>Casa sin patio</option>
        </select>
      </div>
      <div class="field"><label>¿Experiencia previa con mascotas?</label>
        <select required id="apExperience">
          <option value="">Selecciona…</option>
          <option>Sí, actualmente tengo</option>
          <option>Sí, tuve antes</option>
          <option>No, sería mi primera mascota</option>
        </select>
      </div>
      <div class="field"><label>¿Por qué quieres adoptar a ${p.name}?</label><textarea required id="apWhy"></textarea></div>
      <button class="adopt-btn" type="submit">Enviar postulación</button>
    </form>
  `;
  document.getElementById('adoptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const applicantName = document.getElementById('apName').value.trim();
    const email = document.getElementById('apEmail').value.trim();
    const phone = document.getElementById('apPhone').value.trim();
    const housing = document.getElementById('apHousing').value;
    const experience = document.getElementById('apExperience').value;
    const why = document.getElementById('apWhy').value.trim();
    try{
      await applicationsCol.add({
        petId: p.id,
        petName: p.name,
        applicantName, email, phone, housing, experience, why,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // ---- Notificación por WhatsApp al refugio/administrador ----
      const ADMIN_WHATSAPP = "51965704325"; // 51 = código de país Perú + número sin espacios
      const waMessage =
        `🐾 Nueva postulación de adopción\n` +
        `Mascota: ${p.name} (${p.origin})\n` +
        `Nombre: ${applicantName}\n` +
        `Correo: ${email}\n` +
        `Teléfono: ${phone}\n` +
        `Vivienda: ${housing}\n` +
        `Experiencia: ${experience}\n` +
        `Motivo: ${why}`;
      const waLink = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(waMessage)}`;
      window.open(waLink, '_blank');

      modal.innerHTML = `
        <button class="modal-close" onclick="closeOverlay('formOverlay')">✕</button>
        <div class="form-success">
          <div class="paw">🐾</div>
          <h3 class="display">¡Postulación enviada!</h3>
          <p>Gracias por querer adoptar a ${p.name}. ${p.origin} revisará tu postulación y te contactará pronto.</p>
          <a class="adopt-btn" style="display:block;text-decoration:none;text-align:center;margin-top:14px;" href="${waLink}" target="_blank" rel="noopener">💬 Abrir WhatsApp con los detalles</a>
        </div>
      `;
    }catch(err){
      console.error("No se pudo enviar la postulación", err);
    }
  });
  document.getElementById('formOverlay').classList.add('open');
}

// ---------------- MODAL: LOGIN DE ADMINISTRADOR ----------------
function openLoginModal(){
  const modal = document.getElementById('loginModal');
  modal.innerHTML = `
    <button class="modal-close" onclick="closeOverlay('loginOverlay')">✕</button>
    <div class="form-title display">Acceso administrador</div>
    <div class="form-sub">Inicia sesión para agregar, editar o eliminar fichas de mascotas.</div>
    <form id="loginForm">
      <div class="field"><label>Correo electrónico</label><input required type="email" id="loginEmail" /></div>
      <div class="field"><label>Contraseña</label><input required type="password" id="loginPassword" /></div>
      <div id="loginError" style="color:var(--clay); font-size:13px; margin-bottom:10px;"></div>
      <button class="adopt-btn" type="submit">Iniciar sesión</button>
    </form>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try{
      await auth.signInWithEmailAndPassword(email, password);
      closeOverlay('loginOverlay');
    }catch(err){
      console.error("No se pudo iniciar sesión", err);
      document.getElementById('loginError').textContent = 'Correo o contraseña incorrectos.';
    }
  });
  document.getElementById('loginOverlay').classList.add('open');
}

function updateAdminUI(){
  const fab = document.getElementById('addPetBtn');
  const adminLink = document.getElementById('adminLink');
  if (isAdmin){
    fab.style.display = 'flex';
    adminLink.textContent = 'Cerrar sesión de administrador';
  } else {
    fab.style.display = 'none';
    adminLink.textContent = 'Acceso administrador';
  }
}

auth.onAuthStateChanged((user) => {
  isAdmin = !!user;
  updateAdminUI();
});

document.getElementById('adminLink').addEventListener('click', () => {
  if (isAdmin){
    auth.signOut();
  } else {
    openLoginModal();
  }
});

// ---------------- OVERLAYS ----------------
function closeOverlay(id){ document.getElementById(id).classList.remove('open'); }
document.getElementById('fichaOverlay').addEventListener('click', (e)=>{ if(e.target.id==='fichaOverlay') closeOverlay('fichaOverlay'); });
document.getElementById('formOverlay').addEventListener('click', (e)=>{ if(e.target.id==='formOverlay') closeOverlay('formOverlay'); });
document.getElementById('petFormOverlay').addEventListener('click', (e)=>{ if(e.target.id==='petFormOverlay') closeOverlay('petFormOverlay'); });
document.getElementById('loginOverlay').addEventListener('click', (e)=>{ if(e.target.id==='loginOverlay') closeOverlay('loginOverlay'); });

// ---------------- CONTROLES DE FILTRO ----------------
document.getElementById('searchInput').addEventListener('input', (e)=>{ state.search = e.target.value; renderGrid(); });
document.getElementById('vaxChip').addEventListener('click', (e)=>{
  state.vaxOnly = !state.vaxOnly;
  e.target.classList.toggle('active');
  renderGrid();
});
document.getElementById('ageRange').addEventListener('input', (e)=>{
  state.maxAge = Number(e.target.value);
  document.getElementById('ageValue').textContent = state.maxAge + ' años';
  renderGrid();
});
document.getElementById('matchBtn').addEventListener('click', () => {
  state = { search:"", types:new Set(), sizes:new Set(), maxAge:12, vaxOnly:true };
  document.getElementById('searchInput').value = "";
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  document.getElementById('vaxChip').classList.add('active');
  document.getElementById('ageRange').value = 12;
  document.getElementById('ageValue').textContent = '12 años';
  renderGrid();
});
document.getElementById('addPetBtn').addEventListener('click', openPetForm);

// ---------------- INIT ----------------
(async function init(){
  renderChips();
  await seedIfNeeded();
  listenPets();
})();
