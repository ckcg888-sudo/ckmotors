const renderBeforeStatuses = render;

render = async function () {
  await renderBeforeStatuses();
  const query = $('search').value.trim().toLowerCase();
  const items = (await all()).filter(record =>
    [record.engineNumber, record.sourceShop, record.customerName, record.customerPhone]
      .some(value => String(value || '').toLowerCase().includes(query))
  ).sort((a, b) => b.txDate.localeCompare(a.txDate) || b.createdAt.localeCompare(a.createdAt));

  document.querySelectorAll('.record').forEach((card, index) => {
    const record = items[index];
    if (!record) return;
    const isDone = record.notifyStatus === 'done';

    const badge = document.createElement('span');
    badge.className = `status ${isDone ? '' : 'no'}`;
    badge.style.marginLeft = '5px';
    badge.textContent = isDone ? 'แจ้งหมายเลขแล้ว' : 'รอแจ้งหมายเลข';
    card.querySelector('.status')?.insertAdjacentElement('afterend', badge);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = isDone ? '↩ เปลี่ยนกลับเป็นรอแจ้งหมายเลข' : '✓ ทำเครื่องหมายว่าแจ้งหมายเลขแล้ว';
    button.style.cssText = `width:100%;border:0;border-top:1px solid #ece9e2;padding:12px;font:inherit;font-size:13px;font-weight:800;color:${isDone ? '#8b4a2e' : '#1f5742'};background:${isDone ? '#fff8f3' : '#edf7f1'}`;
    button.onclick = () => toggleNotifyStatus(record.id);
    card.querySelector('.record-actions')?.insertAdjacentElement('beforebegin', button);
  });
};

window.toggleNotifyStatus = async id => {
  try {
    const record = await readSavedRecord(id);
    if (!record) return notify('ไม่พบรายการนี้');
    record.notifyStatus = record.notifyStatus === 'done' ? 'pending' : 'done';
    record.statusUpdatedAt = new Date().toISOString();
    await committedPut(record);
    const verified = await readSavedRecord(id);
    if (verified?.notifyStatus !== record.notifyStatus) throw new Error('ตรวจสอบสถานะไม่ผ่าน');
    await render();
    notify(record.notifyStatus === 'done' ? 'เปลี่ยนเป็นแจ้งหมายเลขแล้ว' : 'เปลี่ยนเป็นรอแจ้งหมายเลขแล้ว');
  } catch (error) {
    console.error('Status update failed:', error);
    notify('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่');
  }
};

render();
