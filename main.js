const { SUPABASE_URL, SUPABASE_KEY } = window.env;
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const map = L.map('map').setView([37.7749, -122.4194], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// 加载地图活动
async function loadPosts() {
  const { data, error } = await supabase
    .from('openpin_public_activities')
    .select('*')
    .order('start_time', { ascending: true });
  if (error) return console.error(error);
  data.forEach(addMarker);
}
window.onload = loadPosts;

function addMarker(post) {
  const marker = L.marker([post.lat, post.lng]).addTo(map);
  const content = `
    <b>${post.title}</b><br>${post.address}<br>${post.start_time}<br>
    ${post.desc || ''}<br>
    ${(post.images || []).map(url => `<img src="${url}" width="180" />`).join('')}
  `;
  marker.bindPopup(content);
}

// 发布活动
async function submitPost() {
  const title = getVal('titleInput');
  const address = getVal('addressInput');
  const start_time = getVal('startTime');
  const end_time = getVal('endTime');
  const desc = getVal('descInput');
  const poster = getVal('posterInput');
  const mediaRaw = getVal('mediaInput');
  const images = mediaRaw.split(/[\s\n]+/).filter(Boolean);
  const loc = await geocodeAddress();

  if (!title || !address || !start_time || !end_time || !loc.lat || !loc.lng) {
    notify("请完整填写标题、地址、时间，并定位成功！");
    return;
  }

  const { error } = await supabase
    .from('openpin_public_activities')
    .insert([{ title, address, start_time, end_time, desc, poster, images, lat: loc.lat, lng: loc.lng }]);

  if (!error) location.reload();
  else notify("提交失败");
}

// 地理定位
async function geocodeAddress(notifyOnly = false) {
  const addr = getVal('addressInput');
  if (!addr) return {};
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
  const data = await res.json();
  if (!data[0]) {
    notify("地址定位失败");
    return {};
  }
  if (notifyOnly) notify("定位成功！");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function togglePostForm() {
  document.getElementById('post-form').classList.toggle('hidden');
}
function cancelPostForm() {
  document.getElementById('post-form').classList.add('hidden');
}
function refreshPostMediaPreview() {
  const urls = getVal('mediaInput').split(/[\s\n]+/).filter(Boolean);
  const preview = document.getElementById('postMediaPreview');
  preview.innerHTML = '';
  urls.forEach(url => {
    const img = document.createElement('img');
    img.src = url;
    preview.appendChild(img);
  });
}
function notify(msg) {
  const el = document.getElementById('notify');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}
function getVal(id) {
  return document.getElementById(id)?.value?.trim();
}
