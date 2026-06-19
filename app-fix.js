// Reliability layer: only clear the form after IndexedDB confirms the transaction.
function committedPut(value) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('ฐานข้อมูลยังไม่พร้อม'));
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('เขียนข้อมูลไม่ได้'));
    tx.onabort = () => reject(tx.error || new Error('พื้นที่จัดเก็บไม่เพียงพอ'));
  });
}

function readSavedRecord(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('ฐานข้อมูลยังไม่พร้อม'));
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('ตรวจสอบข้อมูลไม่ได้'));
    tx.onabort = () => reject(tx.error || new Error('ตรวจสอบข้อมูลไม่ได้'));
  });
}

function compactImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านรูปไม่ได้'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('ไฟล์รูปนี้ไม่รองรับ'));
      image.onload = () => {
        const maxSize = 1280;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('enginePhoto').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    showPreview(await compactImage(file));
  } catch (error) {
    event.target.value = '';
    notify(error.message);
  }
};

$('entryForm').onsubmit = async event => {
  event.preventDefault();
  if (!pendingImage) return notify('กรุณาอัปโหลดรูปหมายเลขเครื่องยนต์');

  const button = $('saveBtn');
  const wasEditing = Boolean(editingId);
  button.disabled = true;
  button.textContent = 'กำลังบันทึก…';

  try {
    const previous = editingId ? await readSavedRecord(editingId) : null;
    const data = {
      id: editingId || crypto.randomUUID(),
      txDate: $('txDate').value,
      sourceShop: $('sourceShop').value.trim(),
      customerTakesNumber: document.querySelector('input[name=customerTakesNumber]:checked').value,
      engineNumber: $('engineNumber').value.trim().toUpperCase(),
      photo: pendingImage,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await committedPut(data);
    const saved = await readSavedRecord(data.id);
    if (!saved || saved.engineNumber !== data.engineNumber || !saved.photo) {
      throw new Error('ตรวจสอบข้อมูลหลังบันทึกไม่ผ่าน');
    }

    await render();
    resetForm();
    notify(wasEditing ? 'แก้ไขและตรวจสอบข้อมูลแล้ว' : 'บันทึกและตรวจสอบข้อมูลแล้ว');
  } catch (error) {
    console.error('Save failed:', error);
    notify('บันทึกไม่สำเร็จ ข้อมูลในฟอร์มยังอยู่ กรุณาลองใหม่');
    button.textContent = wasEditing ? 'บันทึกการแก้ไข' : 'บันทึกรายการ';
  } finally {
    button.disabled = false;
  }
};

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
