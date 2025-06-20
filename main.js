// 从 env.js 读取配置（或内联注入）
const { SUPABASE_URL, SUPABASE_KEY } = window.env;
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map;                // 全局变量，用于后续 marker 操作
let posts = [];         // 活动缓存
let tempLatLng = null;  // 临时定位点
let editingPostId = null;

// 等待 DOM 加载后再初始化地图和内容
window.onload = () => {
  // ----------- 初始化地图 ------------
  map = L.map('map').setView([37.7749, -122.4194], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 加载活动数据
  loadPosts();

  // 初始化时钟
  updateClock();
  setInterval(updateClock, 1000);
};

// ----------- 实时时钟 ------------
function updateClock() {
  const now = new Date();
  document.getElementById("clock").innerText = now.toLocaleString();
}

// ----------- 通知条 ------------
function notify(msg, timeout = 2000) {
  const n = document.getElementById("notify");
  n.innerText = msg;
  n.classList.remove("hidden");
  setTimeout(() => { n.classList.add("hidden"); }, timeout);
}

// ----------- 发帖表单控制 ------------
function togglePostForm() {
  const form = document.getElementById("post-form");
  form.classList.toggle("hidden");
  if (form.classList.contains("hidden")) clearPostForm();
}
function clearPostForm() {
  ["titleInput", "addressInput", "startTime", "endTime", "descInput", "posterInput", "mediaInput"]
    .forEach(id => document.getElementById(id).value = "");
  tempLatLng = null;
  document.getElementById("postMediaPreview").innerHTML = "";
}
function cancelPostForm() {
  clearPostForm();
  document.getElementById("post-form").classList.add("hidden");
}

// ----------- 地址地理编码 ------------
function geocodeAddress(focus) {
  const address = document.getElementById("addressInput").value.trim();
  if (!address) return notify("请输入活动地址");
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) return notify("地址未找到");
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      tempLatLng = [lat, lon];
      if (focus) map.setView([lat, lon], 16);
    })
    .catch(() => notify("地理编码失败"));
}

// ----------- 图片预览 ------------
function isImageURL(url) {
  return /\.(png|jpg|jpeg|gif|bmp|svg|webp)(\?.*)?$/i.test(url);
}
function refreshPostMediaPreview() {
  const input = document.getElementById("mediaInput");
  const preview = document.getElementById("postMediaPreview");
  preview.innerHTML = "";
  const urls = input.value.split(/[\s\n]+/).filter(Boolean);
  urls.forEach(url => {
    if (isImageURL(url)) {
      const img = document.createElement("img");
      img.src = url;
      img.onclick = () => showImgViewer(url);
      preview.appendChild(img);
    }
  });
}
function showImgViewer(url) {
  document.getElementById("img-viewer-img").src = url;
  document.getElementById("img-viewer").classList.remove("hidden");
}
function hideImgViewer() {
  document.getElementById("img-viewer").classList.add("hidden");
}

// ----------- 提交活动 ------------
async function submitPost() {
  const title = document.getElementById("titleInput").value.trim();
  const address = document.getElementById("addressInput").value.trim();
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const desc = document.getElementById("descInput").value.trim();
  const poster = document.getElementById("posterInput").value.trim();
  const mediaInput = document.getElementById("mediaInput").value.trim();
  const images = mediaInput.split(/[\s\n]+/).filter(isImageURL);

  if (!title || !address || !startTime || !endTime) return notify("请完整填写信息");
  if (startTime > endTime) return notify("开始时间不能晚于结束时间");
  if (!tempLatLng) return notify("请先定位");

  const post = {
    title,
    address,
    start_time: startTime,
    end_time: endTime,
    desc,
    poster,
    images,
    lat: tempLatLng[0],
    lng: tempLatLng[1]
  };

  const { error } = await supabase.from('openpin_public_activities').insert([post]);
  if (error) return notify("提交失败: " + error.message);

  notify("活动发布成功！");
  clearPostForm();
  document.getElementById("post-form").classList.add("hidden");
  loadPosts();
}

// ----------- 加载活动并展示到地图 ------------
async function loadPosts() {
  const { data, error } = await supabase
    .from('openpin_public_activities')
    .select('*')
    .order('start_time', { ascending: true });

  if (error) return notify("数据加载失败");

  posts = data || [];

  // 清除旧 marker
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });

  posts.forEach((post, idx) => {
    const marker = L.marker([post.lat, post.lng]).addTo(map);
    const popup = `
      <b>${post.title}</b><br>
      ${post.address}<br>
      ${post.desc || ""}<br>
      ${post.poster ? `<small>发帖人：${post.poster}</small>` : ""}
    `;
    marker.bindPopup(popup);
  });
}
