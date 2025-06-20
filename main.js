// ✅ 从 window.env 中读取配置（你已经在 index.html 中定义）
const { SUPABASE_URL, SUPABASE_KEY } = window.env;
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); // 避免变量冲突

let map;
let posts = [];
let tempLatLng = null;

window.onload = () => {
  // ✅ 初始化地图
  map = L.map('map').setView([37.7749, -122.4194], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // ✅ 加载活动数据
  loadPosts();

  // ✅ 启动时钟
  updateClock();
  setInterval(updateClock, 1000);
};

// ---------- 时钟显示 ----------
function updateClock() {
  const now = new Date();
  document.getElementById("clock").innerText = now.toLocaleString();
}

// ---------- 通知提示 ----------
function notify(msg, timeout = 2000) {
  const n = document.getElementById("notify");
  n.innerText = msg;
  n.classList.remove("hidden");
  setTimeout(() => n.classList.add("hidden"), timeout);
}

// ---------- 发帖表单 ----------
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

// ---------- 地址定位 ----------
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
      if (focus) map.setView(tempLatLng, 16);
    })
    .catch(() => notify("地理编码失败"));
}

// ---------- 图片预览 ----------
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
      preview.appendChild(img);
    }
  });
}

// ---------- 提交活动 ----------
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

  const { error } = await supa.from('openpin_public_activities').insert([post]);
  if (error) return notify("提交失败: " + error.message);

  notify("活动发布成功！");
  clearPostForm();
  document.getElementById("post-form").classList.add("hidden");
  loadPosts();
}

// ---------- 加载活动 ----------
async function loadPosts() {
  const { data, error } = await supa
    .from('openpin_public_activities')
    .select('*')
    .order('start_time', { ascending: true });

  if (error) return notify("数据加载失败");

  posts = data || [];

  // 清除旧 marker
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });

  posts.forEach(post => {
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
