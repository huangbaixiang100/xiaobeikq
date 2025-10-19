# 小北儿童口腔疾病识别API使用文档

## 📋 目录
1. [快速开始](#快速开始)
2. [模型路径](#模型路径)
3. [API接口说明](#api接口说明)
4. [使用示例](#使用示例)
5. [部署说明](#部署说明)
6. [前端集成](#前端集成)

---

## 🚀 快速开始

### 1. 启动服务

```bash
# 方式1: 使用启动脚本（推荐）
bash /home/xiaobei/hbx/乳牙滞留识别/start_api.sh

# 方式2: 手动启动
conda activate AgenticRAG
cd /home/xiaobei/hbx/乳牙滞留识别
python api_service.py
```

### 2. 访问服务

- **API地址**: http://localhost:8000
- **交互式文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health

---

## 📁 模型路径

训练好的模型权重位置：

```
Mouth检测模型: /home/xiaobei/hbx/乳牙滞留识别/models/mouth_detection/best.pt
疾病检测模型: /home/xiaobei/hbx/乳牙滞留识别/complete_results_101/disease_detection_yolo11s/weights/best.pt
```

---

## 🔌 API接口说明

### 1. 健康检查
```
GET /health
```

**响应示例**:
```json
{
  "status": "healthy",
  "models_loaded": true,
  "device": "cuda"
}
```

---

### 2. 完整分析（推荐使用）
```
POST /api/v1/analyze
```

**描述**: 上传原始口腔图像，自动完成两阶段检测

**请求**:
- Content-Type: `multipart/form-data`
- 参数: `file` (图像文件)

**响应示例**:
```json
{
  "success": true,
  "message": "分析完成",
  "mouth_detected": true,
  "mouth_box": {
    "x1": 120.5,
    "y1": 80.3,
    "x2": 450.2,
    "y2": 380.7,
    "confidence": 0.92,
    "class_name": "mouth"
  },
  "classification": "乳牙滞留",
  "confidence": 0.87,
  "disease_areas": [
    {
      "x1": 200.1,
      "y1": 150.3,
      "x2": 280.5,
      "y2": 220.8,
      "confidence": 0.87,
      "class_name": "disease_area"
    }
  ],
  "annotated_image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "recommendations": [
    "⚕️ 检测到乳牙滞留，建议尽快带孩子到口腔科就诊",
    "🦷 可能需要拔除滞留的乳牙，以免影响恒牙生长",
    "⏰ 建议一周内就诊",
    "🍎 近期避免让孩子用力咬硬物",
    "🪥 保持口腔清洁，早晚刷牙"
  ]
}
```

---

### 3. Mouth区域检测
```
POST /api/v1/detect-mouth
```

**描述**: 仅检测mouth区域并返回裁剪图像

**请求**:
- Content-Type: `multipart/form-data`
- 参数: `file` (图像文件)

**响应示例**:
```json
{
  "success": true,
  "message": "Mouth区域检测成功",
  "mouth_detected": true,
  "mouth_box": {
    "x1": 120.5,
    "y1": 80.3,
    "x2": 450.2,
    "y2": 380.7,
    "confidence": 0.92,
    "class_name": "mouth"
  },
  "cropped_image_base64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

---

### 4. Disease区域检测
```
POST /api/v1/detect-disease
```

**描述**: 对裁剪后的mouth图像检测disease区域

**请求**:
- Content-Type: `multipart/form-data`
- 参数: `file` (裁剪后的mouth图像)

**响应示例**:
```json
{
  "success": true,
  "message": "检测完成: 乳牙滞留",
  "classification": "乳牙滞留",
  "confidence": 0.87,
  "disease_areas": [...],
  "has_disease": true
}
```

---

## 💻 使用示例

### Python示例

```python
import requests

# 1. 健康检查
response = requests.get('http://localhost:8000/health')
print(response.json())

# 2. 完整分析
with open('test_image.jpg', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:8000/api/v1/analyze', files=files)
    result = response.json()
    
    print(f"分类结果: {result['classification']}")
    print(f"置信度: {result['confidence']}")
    print(f"建议: {result['recommendations']}")
```

### cURL示例

```bash
# 健康检查
curl http://localhost:8000/health

# 完整分析
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_image.jpg"
```

### JavaScript/Fetch示例

```javascript
// 完整分析
async function analyzeImage(imageFile) {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  const response = await fetch('http://localhost:8000/api/v1/analyze', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  console.log('分类结果:', result.classification);
  console.log('置信度:', result.confidence);
  console.log('建议:', result.recommendations);
  
  // 显示标注后的图像
  const imgElement = document.getElementById('result-image');
  imgElement.src = 'data:image/jpeg;base64,' + result.annotated_image_base64;
}
```

---

## 🌐 部署说明

### 本地开发环境

```bash
# 1. 确保已激活AgenticRAG环境
conda activate AgenticRAG

# 2. 启动服务（默认端口8000）
bash start_api.sh
```

### 生产环境部署

#### 方式1: 使用systemd（推荐）

创建服务文件 `/etc/systemd/system/oral-detection-api.service`:

```ini
[Unit]
Description=小北儿童口腔疾病识别API服务
After=network.target

[Service]
Type=simple
User=xiaobei
WorkingDirectory=/home/xiaobei/hbx/乳牙滞留识别
Environment="PATH=/data/xiaobei/anaconda3/envs/AgenticRAG/bin"
ExecStart=/data/xiaobei/anaconda3/envs/AgenticRAG/bin/python api_service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:
```bash
sudo systemctl daemon-reload
sudo systemctl start oral-detection-api
sudo systemctl enable oral-detection-api
sudo systemctl status oral-detection-api
```

#### 方式2: 使用supervisor

安装supervisor:
```bash
sudo apt-get install supervisor
```

创建配置文件 `/etc/supervisor/conf.d/oral-detection-api.conf`:

```ini
[program:oral-detection-api]
command=/data/xiaobei/anaconda3/envs/AgenticRAG/bin/python /home/xiaobei/hbx/乳牙滞留识别/api_service.py
directory=/home/xiaobei/hbx/乳牙滞留识别
user=xiaobei
autostart=true
autorestart=true
stderr_logfile=/var/log/oral-detection-api.err.log
stdout_logfile=/var/log/oral-detection-api.out.log
```

启动服务:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start oral-detection-api
```

#### 方式3: 使用nginx反向代理（推荐用于外网访问）

nginx配置示例:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持大文件上传
        client_max_body_size 10M;
    }
}
```

---

## 🖥️ 前端集成示例

### HTML + JavaScript完整示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>小北儿童口腔检测</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; }
        .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; }
        .result { margin-top: 20px; padding: 20px; background: #f5f5f5; }
        img { max-width: 100%; }
    </style>
</head>
<body>
    <h1>小北儿童口腔疾病识别</h1>
    
    <div class="upload-area">
        <input type="file" id="imageInput" accept="image/*">
        <button onclick="analyzeImage()">开始分析</button>
    </div>
    
    <div id="result" class="result" style="display:none;">
        <h2>分析结果</h2>
        <p><strong>分类:</strong> <span id="classification"></span></p>
        <p><strong>置信度:</strong> <span id="confidence"></span></p>
        <h3>建议:</h3>
        <ul id="recommendations"></ul>
        <img id="resultImage" alt="分析结果">
    </div>

    <script>
        async function analyzeImage() {
            const fileInput = document.getElementById('imageInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('请先选择图像文件');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const response = await fetch('http://localhost:8000/api/v1/analyze', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // 显示结果
                    document.getElementById('result').style.display = 'block';
                    document.getElementById('classification').textContent = result.classification;
                    document.getElementById('confidence').textContent = 
                        (result.confidence * 100).toFixed(2) + '%';
                    
                    // 显示建议
                    const recList = document.getElementById('recommendations');
                    recList.innerHTML = '';
                    result.recommendations.forEach(rec => {
                        const li = document.createElement('li');
                        li.textContent = rec;
                        recList.appendChild(li);
                    });
                    
                    // 显示标注图像
                    document.getElementById('resultImage').src = 
                        'data:image/jpeg;base64,' + result.annotated_image_base64;
                } else {
                    alert('分析失败: ' + result.message);
                }
            } catch (error) {
                alert('请求失败: ' + error.message);
            }
        }
    </script>
</body>
</html>
```

# 乳牙滞留识别API - 新功能使用说明

## 版本 2.0.0 - 新增功能

本次更新在保持原有功能不变的基础上，新增了以下三个功能：

### 1. 图片保存功能
### 2. 图片清晰度检测（拉普拉斯方差）
### 3. 图片曝光度检测（平均亮度）

---

## 📋 新增功能详情

### 功能1: 图片保存功能

**描述**: 允许用户选择是否将上传的原始图片保存到服务器指定路径。

**保存位置**: `/data/xiaobei/hbx/picture`

**文件命名**: `image_{timestamp}.jpg` （例如：`image_20251019_143025_123456.jpg`）

**使用方式**: 在调用 `/api/v1/analyze` 接口时，添加 `save_image_flag` 查询参数。

---

### 功能2: 拉普拉斯方差计算（清晰度检测）

**描述**: 使用OpenCV的拉普拉斯算子计算图片的方差，用于衡量图片清晰度。

**计算方法**: `cv2.Laplacian(gray_image, cv2.CV_64F).var()`

**指标含义**:
- **高方差 (>200)**: 图片清晰
- **中等方差 (100-200)**: 清晰度一般
- **低方差 (<100)**: 图片模糊

---

### 功能3: 曝光度计算（平均亮度）

**描述**: 将图片转换为灰度图，计算平均亮度值，用于评估图片的曝光情况。

**计算方法**: `np.mean(gray_image)`

**指标含义**:
- **过暗 (<50)**: 曝光不足
- **适中 (80-180)**: 曝光良好
- **过亮 (>200)**: 曝光过度

---

## 🔌 API接口更新

### 1. 完整分析接口（已更新）

**接口**: `POST /api/v1/analyze`

**新增参数**:
- `save_image_flag`: 布尔值，是否保存原始图片（默认：false）

**新增返回字段**:
```json
{
  "sharpness": 256.7,          // 拉普拉斯方差（清晰度）
  "exposure": 128.5,           // 曝光度（平均亮度）
  "image_saved": true,         // 图片是否已保存
  "saved_image_path": "/data/xiaobei/hbx/picture/image_20251019_143025.jpg"
}
```

**完整响应示例**:
```json
{
  "success": true,
  "message": "分析完成",
  "mouth_detected": true,
  "mouth_box": {
    "x1": 120.5,
    "y1": 80.3,
    "x2": 450.2,
    "y2": 380.7,
    "confidence": 0.92,
    "class_name": "mouth"
  },
  "classification": "乳牙滞留",
  "probability": 0.9543,
  "probabilities": {
    "非乳牙滞留": 0.0457,
    "乳牙滞留": 0.9543
  },
  "cropped_mouth_image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "recommendations": [
    "⚠️ 高置信度检测到乳牙滞留，强烈建议尽快带孩子到口腔科就诊",
    "🦷 可能需要拔除滞留的乳牙，以免影响恒牙生长"
  ],
  "sharpness": 256.7,
  "exposure": 128.5,
  "image_saved": true,
  "saved_image_path": "/data/xiaobei/hbx/picture/image_20251019_143025_123456.jpg"
}
```

---

### 2. 图片质量检测接口（新增）

**接口**: `POST /api/v1/quality-check`

**描述**: 专门用于检测图片质量，返回清晰度、曝光度及改善建议。

**请求示例**:
```bash
curl -X POST "http://localhost:15025/api/v1/quality-check" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_image.jpg"
```

**响应示例**:
```json
{
  "success": true,
  "message": "图片质量检测完成，质量等级: 优秀",
  "sharpness": 356.8,
  "exposure": 142.3,
  "quality_assessment": "优秀",
  "recommendations": [
    "✅ 图片清晰度良好",
    "✅ 曝光度适中"
  ]
}
```

**质量评估等级**:
- **优秀**: 清晰度和曝光度都良好
- **良好**: 有一项指标需要改善
- **需要改善**: 清晰度和曝光度都需要改善

---

## 💻 使用示例

### Python示例

#### 示例1: 完整分析并保存图片

```python
import requests

# 上传图片，进行完整分析，并保存原始图片
with open('test_image.jpg', 'rb') as f:
    files = {'file': f}
    params = {'save_image_flag': True}  # 保存图片
    response = requests.post(
        'http://localhost:15025/api/v1/analyze',
        files=files,
        params=params
    )
    result = response.json()
    
    print(f"分类结果: {result['classification']}")
    print(f"预测概率: {result['probability']:.2%}")
    print(f"清晰度: {result['sharpness']:.2f}")
    print(f"曝光度: {result['exposure']:.2f}")
    print(f"图片已保存: {result['image_saved']}")
    if result['image_saved']:
        print(f"保存路径: {result['saved_image_path']}")
```

#### 示例2: 仅检测图片质量

```python
import requests

# 仅检测图片质量
with open('test_image.jpg', 'rb') as f:
    files = {'file': f}
    response = requests.post(
        'http://localhost:15025/api/v1/quality-check',
        files=files
    )
    result = response.json()
    
    print(f"质量评估: {result['quality_assessment']}")
    print(f"清晰度指标: {result['sharpness']:.2f}")
    print(f"曝光度指标: {result['exposure']:.2f}")
    print("改善建议:")
    for rec in result['recommendations']:
        print(f"  - {rec}")
```

#### 示例3: 完整分析（不保存图片）

```python
import requests

# 上传图片，进行完整分析，但不保存
with open('test_image.jpg', 'rb') as f:
    files = {'file': f}
    # 不传 save_image_flag 或设为 False
    response = requests.post(
        'http://localhost:15025/api/v1/analyze',
        files=files
    )
    result = response.json()
    
    print(f"分类结果: {result['classification']}")
    print(f"清晰度: {result['sharpness']:.2f}")
    print(f"曝光度: {result['exposure']:.2f}")
    # image_saved 会是 False 或 None
```

---

### cURL示例

#### 示例1: 完整分析并保存图片

```bash
curl -X POST "http://localhost:15025/api/v1/analyze?save_image_flag=true" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_image.jpg"
```

#### 示例2: 仅检测图片质量

```bash
curl -X POST "http://localhost:15025/api/v1/quality-check" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_image.jpg"
```

#### 示例3: 完整分析（不保存图片）

```bash
curl -X POST "http://localhost:15025/api/v1/analyze" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_image.jpg"
```

---

### JavaScript/Fetch示例

```javascript
// 完整分析并保存图片
async function analyzeAndSaveImage(imageFile) {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  // 添加 save_image_flag 参数
  const response = await fetch(
    'http://localhost:15025/api/v1/analyze?save_image_flag=true',
    {
      method: 'POST',
      body: formData
    }
  );
  
  const result = await response.json();
  console.log('分类结果:', result.classification);
  console.log('清晰度:', result.sharpness);
  console.log('曝光度:', result.exposure);
  console.log('图片已保存:', result.image_saved);
  if (result.image_saved) {
    console.log('保存路径:', result.saved_image_path);
  }
}

// 仅检测图片质量
async function checkImageQuality(imageFile) {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  const response = await fetch(
    'http://localhost:15025/api/v1/quality-check',
    {
      method: 'POST',
      body: formData
    }
  );
  
  const result = await response.json();
  console.log('质量评估:', result.quality_assessment);
  console.log('清晰度:', result.sharpness);
  console.log('曝光度:', result.exposure);
  console.log('改善建议:', result.recommendations);
}
```

---

## 📊 质量指标参考值

### 清晰度（拉普拉斯方差）

| 范围 | 评估 | 说明 |
|------|------|------|
| < 100 | 模糊 | 建议重新拍摄更清晰的照片 |
| 100-200 | 一般 | 可用，但建议提高拍摄稳定性 |
| > 200 | 良好 | 清晰度良好，适合分析 |

### 曝光度（平均亮度）

| 范围 | 评估 | 说明 |
|------|------|------|
| < 50 | 过暗 | 建议增加光照或提高曝光度 |
| 50-80 | 偏暗 | 可用，但建议调整光线 |
| 80-180 | 适中 | 曝光良好，适合分析 |
| 180-200 | 偏亮 | 可用，但建议调整光线 |
| > 200 | 过亮 | 建议降低光照或减少曝光度 |

---

## 🔧 配置说明

### 修改图片保存路径

在 `api_service.py` 中修改：

```python
# 图片保存路径
SAVE_IMAGE_DIR = Path('/data/xiaobei/hbx/picture')  # 修改为你想要的路径
```

### 修改质量评估阈值

在 `assess_image_quality()` 函数中修改阈值：

```python
def assess_image_quality(sharpness: float, exposure: float) -> tuple:
    # 评估清晰度
    if sharpness < 100:  # 修改此阈值
        quality_issues.append("图片模糊")
    elif sharpness < 200:  # 修改此阈值
        quality_issues.append("清晰度一般")
    
    # 评估曝光度
    if exposure < 50:  # 修改此阈值
        quality_issues.append("曝光不足")
    elif exposure > 200:  # 修改此阈值
        quality_issues.append("曝光过度")
    # ...
```

---

## 🎯 应用场景

### 场景1: 数据收集与分析
使用 `save_image_flag=true` 保存所有上传的图片，用于后续数据分析和模型训练。

### 场景2: 图片质量预检
在正式分析前，先使用 `/api/v1/quality-check` 接口检测图片质量，引导用户重新拍摄低质量图片。

### 场景3: 完整诊断流程
使用 `/api/v1/analyze?save_image_flag=true` 一次性完成图片保存、质量检测和疾病诊断，获取完整的分析报告。

---

## 🐛 常见问题

### Q: 图片保存失败怎么办？
A: 检查以下几点：
1. 目录 `/data/xiaobei/hbx/picture` 是否存在
2. 程序是否有写入权限
3. 磁盘空间是否充足

### Q: 为什么清晰度指标偏低？
A: 可能的原因：
1. 拍摄时手抖导致模糊
2. 镜头对焦不准确
3. 图片分辨率过低

### Q: 如何提高曝光度？
A: 建议：
1. 增加拍摄环境的光照
2. 调整相机/手机的曝光补偿
3. 避免逆光拍摄

### Q: 原有功能是否受影响？
A: 不受影响！所有原有功能保持不变：
- `/api/v1/detect-mouth` 功能不变
- `/api/v1/classify` 功能不变
- `/api/v1/analyze` 功能不变（只是新增了可选参数和返回字段）

---

## 📞 技术支持

如有任何问题或建议，请联系开发团队。

**API版本**: 2.0.0  
**更新日期**: 2025-10-19  
**兼容性**: 向后兼容 1.0.0 版本


