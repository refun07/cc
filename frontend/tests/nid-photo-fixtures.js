// Synthetic identity layouts only; no real card, portrait, seal or identifier.
export const PHOTO_EXPECTED = { name: 'SAMPLE RAHMAN PERSON', date_of_birth: '1990-02-20', nid_number: '5837291640' };

export const PHOTO_CASES = [
  { id: 'clear-bilingual', label: 'Bilingual card on phone-photo background', angle: 0, size: 1000 },
  { id: 'tilted-12', label: '12 degree tilt, JPEG compression', angle: 12, size: 1000, quality: .65 },
  { id: 'tilted-minus-9', label: 'Negative tilt, smaller card', angle: -9, size: 780, quality: .65 },
  { id: 'perspective', label: 'Off-axis camera, perspective and tilt', angle: 5, size: 1000, perspective: true, quality: .72 },
  { id: 'dim-shadow', label: 'Dim indoor light with uneven shadow', angle: -4, size: 1050, dim: .30, shadow: .30, quality: .65 },
  { id: 'low-resolution', label: 'Small card, 680px photo, JPEG artifacts', angle: 0, size: 780, resolution: 680, quality: .45 },
  { id: 'soft-focus', label: 'Mild camera blur with rotation', angle: 5, size: 1100, blur: .65, quality: .65 },
  { id: 'different-identity', label: 'Different name, D/M/Y, 13-digit number, tilted', angle: -7, size: 1000, quality: .60, expected:{name:'SAMPLE FARZANA AKTER',date_of_birth:'1988-11-09',nid_number:'7482961538072'}, printedDate:'09/11/1988' },
  { id: 'tiny-name', label: 'Small English name and labels, compressed photo', angle: 3, size: 900, quality: .55, nameSize:22, expected:{name:'TEST MONOWARA PERSON',date_of_birth:'1975-05-31',nid_number:'19754829615380726'}, printedDate:'31 May 1975' },
  { id: 'unreadable', label: 'Severe blur: must not invent identity', angle: 8, size: 780, blur: 5, quality: .35, reject: true },
];

function cardCanvas(spec) {
  const expected=spec.expected || PHOTO_EXPECTED;
  const c = document.createElement('canvas'); c.width = 1000; c.height = 630;
  const g = c.getContext('2d');
  g.fillStyle = '#eaf3e4'; g.fillRect(0, 0, 1000, 630);
  g.strokeStyle = '#c6d7c1'; g.lineWidth = 2;
  for (let y = 40; y < 630; y += 18) {
    g.beginPath();
    for (let x = 0; x <= 1000; x += 5) { const py = y + Math.sin(x / 45) * 9; if (!x) g.moveTo(x, py); else g.lineTo(x, py); }
    g.stroke();
  }
  const text = (value, x, y, size = 25, color = '#202822', weight = 'normal') => {
    g.fillStyle = color; g.font = `${weight} ${size}px Arial, sans-serif`; g.fillText(value, x, y);
  };
  g.fillStyle = '#e1e9dc'; g.fillRect(0, 0, 1000, 130);
  text('SYNTHETIC QA SAMPLE - NOT A VALID ID', 180, 38, 28, '#36503f', 'bold');
  text('পরীক্ষামূলক পরিচয়পত্র / SAMPLE IDENTITY CARD', 185, 80, 27);
  text('FICTIONAL DATA ONLY', 370, 112, 22, '#913e53');
  g.fillStyle = '#c0c8c8'; g.fillRect(38, 165, 210, 290);
  g.fillStyle = '#879395'; g.beginPath(); g.arc(143, 242, 46, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(143, 369, 74, 93, 0, 0, Math.PI * 2); g.fill();
  text('NO REAL PORTRAIT', 47, 482, 19);
  text('নাম: নমুনা রহমান পারসন', 285, 187, 27, '#202822', 'bold');
  text('Name', 285, 227, 20);
  text(expected.name, 285, 260, spec.nameSize || 29, '#17231d', 'bold');
  text('পিতা: নমুনা পিতা', 285, 319, 27);
  text('মাতা: নমুনা মাতা', 285, 374, 27);
  text(`Date of Birth: ${spec.printedDate || '20 Feb 1990'}`, 285, 442, 28);
  text(`ID No: ${spec.expected ? expected.nid_number : '583 729 1640'}`, 285, 505, 33, '#17231d', 'bold');
  g.fillStyle = '#bea653'; g.fillRect(810, 310, 120, 90);
  g.strokeStyle = '#7e713f'; g.strokeRect(810, 310, 120, 90);
  text('TEST', 836, 366, 24);
  text('SAMPLE / পরীক্ষার জন্য', 290, 585, 31, '#839482');
  return c;
}

function projectCard(source) {
  // A strip-warped trapezoid simulates the unequal edge sizes of an off-axis photo.
  const c = document.createElement('canvas'); c.width = 1000; c.height = 700;
  const g = c.getContext('2d');
  for (let x = 0; x < 1000; x += 2) {
    const t = x / 1000, top = 70 * t, height = 630 - 110 * t;
    g.drawImage(source, x, 0, 2, 630, x, top, 2.3, height);
  }
  return c;
}

export async function makePhotoFixture(spec) {
  await document.fonts.ready;
  const card = cardCanvas(spec), source = spec.perspective ? projectCard(card) : card;
  const c = document.createElement('canvas'); c.width = 1400; c.height = 1100;
  const g = c.getContext('2d');
  g.fillStyle = '#554a40'; g.fillRect(0, 0, c.width, c.height);
  for (let x = 0; x < c.width; x += 47) {
    g.fillStyle = x % 94 ? '#5e5146' : '#4d443e'; g.fillRect(x, 0, 7, c.height);
  }
  g.save(); g.translate(700, 550); g.rotate(spec.angle * Math.PI / 180);
  g.shadowColor = '#0007'; g.shadowBlur = 16; g.shadowOffsetY = 9;
  g.drawImage(source, -spec.size / 2, -spec.size * source.height / source.width / 2, spec.size, spec.size * source.height / source.width);
  g.restore();
  if (spec.shadow) {
    const shade = g.createLinearGradient(250, 0, 1150, 0);
    shade.addColorStop(0, `rgba(0,0,0,${spec.shadow})`); shade.addColorStop(1, 'transparent');
    g.fillStyle = shade; g.fillRect(0, 0, c.width, c.height);
  }
  const out = document.createElement('canvas'), scale = (spec.resolution || 1400) / 1400;
  out.width = Math.round(1400 * scale); out.height = Math.round(1100 * scale);
  const og = out.getContext('2d');
  og.filter = `blur(${spec.blur || 0}px) brightness(${1 - (spec.dim || 0)})`;
  og.drawImage(c, 0, 0, out.width, out.height);
  const blob = await new Promise(resolve => out.toBlob(resolve, 'image/jpeg', spec.quality || .9));
  c.width = c.height = card.width = card.height = source.width = source.height = out.width = out.height = 0;
  return new File([blob], `${spec.id}.jpg`, {type:'image/jpeg'});
}
