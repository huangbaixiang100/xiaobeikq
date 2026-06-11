# 小北儿童口腔疾病识别API - 外部调用文档

## 📋 概述

**服务地址**: `http://60.28.106.46:15025`
**API版本**: v1.0.0
**服务类型**: RESTful API
**数据格式**: JSON
**认证方式**: 无需认证

### 🚀 快速开始

```python
import requests

# API基础地址
BASE_URL = "http://60.28.106.46:15025"

# 健康检查
response = requests.get(f"{BASE_URL}/health")
print(response.json())
```

---

## 📚 API端点

### 1. 服务信息 `/`

**方法**: GET

**描述**: 获取API服务的基本信息

**响应示例**:
```json
{
  "service": "小北儿童口腔疾病识别API",
  "version": "2.0.0",
  "status": "running",
  "device": "cuda:7",
  "save_image_directory": "/data/xiaobei/hbx/picture",
  "endpoints": {
    "complete_analysis": "/api/v1/analyze (支持save_image_flag、include_heatmap参数)",
    "mouth_detection": "/api/v1/detect-mouth",
    "classification": "/api/v1/classify (支持include_heatmap参数)",
    "quality_check": "/api/v1/quality-check",
    "heatmap_full": "/api/v1/heatmap (两阶段热力图)",
    "heatmap_stage2": "/api/v1/stage2-heatmap (仅第二阶段Grad-CAM热力图)",
    "health": "/health"
  },
  "new_features": [
    "图片保存功能 (save_image_flag参数)",
    "拉普拉斯方差计算 (清晰度检测)",
    "曝光度计算 (平均亮度)",
    "图片质量评估接口",
    "第二阶段Grad-CAM热力图 (include_heatmap / /api/v1/stage2-heatmap)"
  ]
}
```

---

### 2. 健康检查 `/health`

**方法**: GET

**描述**: 检查API服务是否正常运行

**响应示例**:
```json
{
  "status": "healthy",
  "models_loaded": true,
  "device": "cuda:7",
  "classifier_classes": ["非乳牙滞留", "乳牙滞留"]
}
```

---

### 3. 完整分析 `/api/v1/analyze`

**方法**: POST

**描述**: 上传口腔图像，自动完成两阶段处理（推荐使用）

#### 请求参数
- **Content-Type**: `multipart/form-data`
- **file**: 口腔图像文件 (必需)
- **save_image_flag**: 是否保存图像到服务器 (可选，默认为 false)
- **include_heatmap**: 是否返回第二阶段 Grad-CAM 热力图 (可选，默认为 false)。为 true 时响应中会包含 `stage2_heatmap_base64`（Base64 编码的 JPEG 热力图）

#### cURL示例
```bash
curl -X POST "http://60.28.106.46:15025/api/v1/analyze" \
  -F "file=@oral_image.jpg" \
  -F "save_image_flag=false" \
  -F "include_heatmap=true"
```

#### Python示例
```python
import requests

def analyze_oral_image(image_path, save_image=False):
    url = "http://60.28.106.46:15025/api/v1/analyze"

    with open(image_path, 'rb') as f:
        files = {'file': f}
        params = {'save_image_flag': save_image, 'include_heatmap': False}  # include_heatmap=True 可返回第二阶段热力图

        response = requests.post(url, files=files, params=params, timeout=60)
        return response.json()

# 使用示例
result = analyze_oral_image("oral_image.jpg")
print(f"诊断结果: {result['classification']}")
print(f"概率: {result['probability']:.3f}")
```

#### 成功响应
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
  "recommendations": [
    "⚠️ 高置信度检测到乳牙滞留，强烈建议尽快带孩子到口腔科就诊",
    "🦷 可能需要拔除滞留的乳牙，以免影响恒牙生长",
    "⏰ 建议一周内就诊"
  ],
  "sharpness": 245.67,
  "exposure": 128.45,
  "cropped_mouth_image_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "stage2_heatmap_base64": null,
  "image_saved": false,
  "saved_image_path": null,
  "verification_info": null
}
```
说明：请求时若传入 `include_heatmap=true`，则 `stage2_heatmap_base64` 为 Base64 编码的第二阶段 Grad-CAM 热力图（JPEG）。

#### 失败响应
```json
{
  "success": false,
  "message": "未检测到mouth区域，请上传包含清晰口腔的图像",
  "mouth_detected": false,
  "classification": "未知",
  "probability": 0.0,
  "probabilities": {},
  "recommendations": ["📸 请重新拍照，确保图像包含清晰的口腔部分"],
  "sharpness": 245.67,
  "exposure": 128.45,
  "image_saved": false,
  "saved_image_path": null
}
```

---

### 4. Mouth区域检测 `/api/v1/detect-mouth`

**方法**: POST

**描述**: 仅检测口腔中的mouth区域

#### 请求参数
- **Content-Type**: `multipart/form-data`
- **file**: 口腔图像文件

#### cURL示例
```bash
curl -X POST "http://60.28.106.46:15025/api/v1/detect-mouth" \
  -F "file=@oral_image.jpg"
```

#### Python示例
```python
import requests

def detect_mouth(image_path):
    url = "http://60.28.106.46:15025/api/v1/detect-mouth"

    with open(image_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(url, files=files, timeout=30)
        return response.json()

result = detect_mouth("oral_image.jpg")
if result['mouth_detected']:
    print("检测到口腔区域")
    box = result['mouth_box']
    print(f"位置: ({box['x1']:.1f}, {box['y1']:.1f}) -> ({box['x2']:.1f}, {box['y2']:.1f})")
```

#### 成功响应
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
  "cropped_image_base64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### 失败响应
```json
{
  "success": false,
  "message": "未检测到mouth区域，请确保图像包含清晰的口腔部分",
  "mouth_detected": false,
  "mouth_box": null,
  "cropped_image_base64": null
}
```

---

### 5. 图像分类 `/api/v1/classify`

**方法**: POST

**描述**: 对已裁剪的 mouth 图像进行分类。可选返回第二阶段 Grad-CAM 热力图。

#### 请求参数
- **Content-Type**: `multipart/form-data`
- **file**: 已裁剪的 mouth 图像文件
- **include_heatmap**: 是否返回第二阶段 Grad-CAM 热力图 (可选，默认 false)。为 true 时响应中包含 `stage2_heatmap_base64`

#### cURL示例
```bash
curl -X POST "http://60.28.106.46:15025/api/v1/classify" \
  -F "file=@cropped_mouth.jpg" \
  -F "include_heatmap=true"
```

#### Python示例
```python
import requests

def classify_image(image_path, include_heatmap=False):
    url = "http://60.28.106.46:15025/api/v1/classify"
    with open(image_path, 'rb') as f:
        files = {'file': f}
        params = {'include_heatmap': include_heatmap}
        response = requests.post(url, files=files, params=params, timeout=30)
        return response.json()

result = classify_image("cropped_mouth.jpg", include_heatmap=True)
print(f"分类结果: {result['classification']}")
print(f"概率: {result['probability']:.3f}")
if result.get('stage2_heatmap_base64'):
    # 热力图 Base64，可解码为图片展示
    pass
```

#### 响应示例
```json
{
  "success": true,
  "message": "分类完成: 乳牙滞留",
  "classification": "乳牙滞留",
  "probability": 0.9543,
  "probabilities": {
    "非乳牙滞留": 0.0457,
    "乳牙滞留": 0.9543
  },
  "stage2_heatmap_base64": "iVBORw0KGgo...",
  "verification_info": null
}
```
（当 `include_heatmap=true` 时，`stage2_heatmap_base64` 为 Base64 编码的 Grad-CAM 热力图 JPEG。）

---

### 6. 两阶段热力图 `/api/v1/heatmap`

**方法**: POST

**描述**: 上传原始口腔图像，生成两阶段完整热力图可视化并返回三张 Base64 图像。

- **Stage 1**：YOLO 口腔检测置信度热力图（叠加在原图）
- **Stage 2**：ResNet34 Grad-CAM 热力图（叠加在裁剪的 mouth 图）
- **合成图**：四格图（原图 | YOLO热力图 | 裁剪图 | Grad-CAM）

#### 请求参数
- **Content-Type**: `multipart/form-data`
- **file**: 口腔图像文件

#### cURL示例
```bash
curl -X POST "http://60.28.106.46:15025/api/v1/heatmap" \
  -F "file=@oral_image.jpg"
```

#### 响应字段
- `stage1_heatmap_base64`: Stage 1 YOLO 置信度热力图
- `stage2_heatmap_base64`: Stage 2 Grad-CAM 热力图
- `composite_heatmap_base64`: 四格合成图
- `classification` / `probability`: 分类结果与概率

---

### 7. 仅第二阶段热力图 `/api/v1/stage2-heatmap`

**方法**: POST

**描述**: 仅返回第二阶段乳牙滞留检测的 **Grad-CAM 热力图**。上传原始口腔图像，先检测并裁剪 mouth 区域，再对裁剪图做 ResNet34 分类并生成热力图，便于展示模型关注的区域。

#### 请求参数
- **Content-Type**: `multipart/form-data`
- **file**: 口腔图像文件

#### cURL示例
```bash
curl -X POST "http://60.28.106.46:15025/api/v1/stage2-heatmap" \
  -F "file=@oral_image.jpg"
```

#### Python示例
```python
import requests
import base64
from PIL import Image
import io

def get_stage2_heatmap(image_path):
    url = "http://60.28.106.46:15025/api/v1/stage2-heatmap"
    with open(image_path, 'rb') as f:
        r = requests.post(url, files={'file': f}, timeout=60)
    data = r.json()
    if not data.get('success'):
        return None
    # 解码热力图展示
    if data.get('stage2_heatmap_base64'):
        img_data = base64.b64decode(data['stage2_heatmap_base64'])
        return Image.open(io.BytesIO(img_data))
    return None
```

#### 成功响应
```json
{
  "success": true,
  "message": "第二阶段热力图生成成功",
  "mouth_detected": true,
  "classification": "乳牙滞留",
  "probability": 0.92,
  "stage2_heatmap_base64": "iVBORw0KGgo...",
  "cropped_mouth_image_base64": "iVBORw0KGgo..."
}
```

#### 失败响应（未检测到口腔）
```json
{
  "success": false,
  "message": "未检测到口腔区域，无法生成热力图",
  "mouth_detected": false,
  "classification": null,
  "probability": null,
  "stage2_heatmap_base64": null,
  "cropped_mouth_image_base64": null
}
```

---

### 8. 图像质量检测 `/api/v1/quality-check`

**方法**: POST

**描述**: 检测图像的清晰度和曝光度

#### 请求参数
- **Content-Type**: `multipart/form-data`
- **file**: 图像文件

#### cURL示例
```bash
curl -X POST "http://60.28.106.46:15025/api/v1/quality-check" \
  -F "file=@oral_image.jpg"
```

#### Python示例
```python
import requests

def check_image_quality(image_path):
    url = "http://60.28.106.46:15025/api/v1/quality-check"

    with open(image_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(url, files=files, timeout=30)
        return response.json()

result = check_image_quality("oral_image.jpg")
print(f"清晰度: {result['sharpness']:.2f}")
print(f"曝光度: {result['exposure']:.2f}")
print(f"质量等级: {result['quality_assessment']}")
```

#### 响应示例
```json
{
  "success": true,
  "message": "图片质量检测完成，质量等级: 优秀",
  "sharpness": 245.67,
  "exposure": 128.45,
  "quality_assessment": "优秀",
  "recommendations": [
    "✅ 图片清晰度良好",
    "✅ 曝光度适中"
  ]
}
```

---

## 🔧 完整客户端示例

### Python完整客户端

```python
#!/usr/bin/env python3
"""
小北儿童口腔疾病识别API客户端
外部调用完整示例
"""

import requests
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any


class OralDiseaseDetectionClient:
    """儿童口腔疾病识别API客户端"""

    def __init__(self, server_url: str = "http://60.28.106.46:15025"):
        """
        初始化客户端

        Args:
            server_url: API服务器地址
        """
        self.base_url = server_url.rstrip('/')
        print(f"🌐 连接到API服务器: {self.base_url}")

    def check_health(self) -> bool:
        """检查API服务健康状态"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            response.raise_for_status()

            result = response.json()
            print("✅ API服务状态:")
            print(f"   状态: {result['status']}")
            print(f"   模型加载: {result['models_loaded']}")
            print(f"   使用设备: {result['device']}")
            print(f"   分类类别: {result['classifier_classes']}")

            return result['status'] == 'healthy' and result['models_loaded']

        except requests.exceptions.RequestException as e:
            print(f"❌ 健康检查失败: {e}")
            return False

    def analyze_image(self, image_path: str, save_image: bool = False) -> Optional[Dict[str, Any]]:
        """
        分析口腔图像（完整流程）

        Args:
            image_path: 图像文件路径
            save_image: 是否让服务器保存图像

        Returns:
            dict: 分析结果
        """
        try:
            if not Path(image_path).exists():
                print(f"❌ 图像文件不存在: {image_path}")
                return None

            with open(image_path, 'rb') as f:
                files = {'file': f}
                params = {'save_image_flag': save_image}

                print(f"🔍 正在分析图像: {image_path}")
                start_time = time.time()

                response = requests.post(
                    f"{self.base_url}/api/v1/analyze",
                    files=files,
                    params=params,
                    timeout=60
                )

                response.raise_for_status()
                result = response.json()

                elapsed_time = time.time() - start_time
                print(f"耗时: {elapsed_time:.2f}s")
                if result.get('success', False):
                    self._display_analysis_result(result)
                    return result
                else:
                    print("❌ 分析失败:")
                    print(f"   原因: {result.get('message', '未知错误')}")
                    return None

        except requests.exceptions.RequestException as e:
            print(f"❌ API请求失败: {e}")
            return None
        except Exception as e:
            print(f"❌ 分析过程出错: {e}")
            return None

    def _display_analysis_result(self, result: Dict[str, Any]):
        """显示分析结果"""
        print("\n" + "="*50)
        print("📊 分析结果详情:")
        print("="*50)

        print(f"🗣️  Mouth检测: {'✅ 成功' if result['mouth_detected'] else '❌ 未检测到'}")
        if result['mouth_detected'] and result.get('mouth_box'):
            box = result['mouth_box']
            print(f"   📦 边界框: ({box['x1']:.1f}, {box['y1']:.1f}) -> ({box['x2']:.1f}, {box['y2']:.1f})")

        classification = result['classification']
        probability = result['probability']
        print("🤖 分类结果:")
        print(f"   📋 诊断: {classification}")
        print(f"   📈 概率: {probability:.1%}")
        print(f"   📊 概率分布:")
        for class_name, prob in result['probabilities'].items():
            print(f"      {class_name}: {prob:.1%}")
        if 'recommendations' in result:
            print("💡 建议:")
            for i, rec in enumerate(result['recommendations'], 1):
                print(f"   {i}. {rec}")

        print("="*50)


def main():
    """主函数示例"""
    # 初始化客户端
    client = OralDiseaseDetectionClient("http://60.28.106.46:15025")

    # 健康检查
    if not client.check_health():
        print("❌ API服务不可用")
        return

    # 分析图像（请替换为实际图像路径）
    test_image = "oral_image.jpg"  # 请替换为你的图像文件

    if Path(test_image).exists():
        result = client.analyze_image(test_image, save_image=False)
        if result:
            print("✅ 分析完成！")
        else:
            print("❌ 分析失败")
    else:
        print(f"⚠️  测试图像不存在: {test_image}")
        print("请准备一张口腔图像进行测试")


if __name__ == "__main__":
    main()
```

### JavaScript客户端示例

```javascript
// 小北儿童口腔疾病识别API客户端
class OralDiseaseDetectionClient {
    constructor(serverUrl = 'http://60.28.106.46:15025') {
        this.baseUrl = serverUrl.replace(/\/$/, '');
    }

    // 健康检查
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const result = await response.json();
            console.log('API健康状态:', result);
            return result.status === 'healthy';
        } catch (error) {
            console.error('健康检查失败:', error);
            return false;
        }
    }

    // 完整分析
    async analyzeImage(file, saveImage = false) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('save_image_flag', saveImage.toString());

            const response = await fetch(`${this.baseUrl}/api/v1/analyze`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                console.log('诊断结果:', result.classification);
                console.log('概率:', result.probability);
                console.log('建议:', result.recommendations);

                // 显示裁剪后的图像
                if (result.cropped_mouth_image_base64) {
                    const img = document.getElementById('result-image');
                    img.src = 'data:image/jpeg;base64,' + result.cropped_mouth_image_base64;
                }

                return result;
            } else {
                console.error('分析失败:', result.message);
                return null;
            }
        } catch (error) {
            console.error('请求失败:', error);
            return null;
        }
    }

    // Mouth检测
    async detectMouth(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/api/v1/detect-mouth`, {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('Mouth检测失败:', error);
            return null;
        }
    }

    // 图像分类
    async classifyImage(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/api/v1/classify`, {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('分类失败:', error);
            return null;
        }
    }

    // 质量检测
    async checkQuality(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/api/v1/quality-check`, {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('质量检测失败:', error);
            return null;
        }
    }
}

// 使用示例
const client = new OralDiseaseDetectionClient();

// 文件输入处理
document.getElementById('image-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 首先检查API健康状态
    const isHealthy = await client.checkHealth();
    if (!isHealthy) {
        alert('API服务不可用');
        return;
    }

    // 分析图像
    const result = await client.analyzeImage(file, false);
    if (result) {
        displayResults(result);
    }
});
```

---

## 📋 错误处理

### 常见HTTP状态码

- **200**: 请求成功
- **400**: 请求参数错误（例如：无效的图像格式）
- **500**: 服务器内部错误

### 常见错误信息

```json
{
  "detail": "无效的图像格式: cannot identify image file"
}
```

```json
{
  "detail": "处理失败: CUDA out of memory"
}
```

---

## 🔒 安全与限制

### 请求限制
- **文件大小**: 建议不超过10MB
- **图像格式**: 支持 JPEG、PNG、BMP 等常见格式
- **超时时间**: 分析请求建议设置60秒超时
- **并发请求**: 建议单用户不超过5个并发请求

### 数据安全
- 上传的图像仅用于分析处理
- 不存储用户个人信息
- 支持可选的服务器端图像保存功能

---

## 📞 技术支持

### 在线文档
- **API文档**: `http://60.28.106.46:15025/docs`
- **健康检查**: `http://60.28.106.46:15025/health`

### 故障排除
1. **连接失败**: 检查网络连接和防火墙设置
2. **分析失败**: 确保图像清晰，包含口腔区域
3. **超时错误**: 增加请求超时时间，检查网络稳定性

### 联系方式
如有技术问题，请联系开发团队。

---

## 📝 更新日志

### v2.1.0
- 新增第二阶段 Grad-CAM 热力图返回：`/api/v1/analyze`、`/api/v1/classify` 支持 `include_heatmap` 参数
- 新增两阶段热力图接口 `/api/v1/heatmap`（Stage1 + Stage2 + 四格合成图）
- 新增仅第二阶段热力图接口 `/api/v1/stage2-heatmap`

### v2.0.0 (2024-11-XX)
- 新增图像质量检测接口
- 新增图片保存功能
- 优化GPU资源使用（支持指定GPU设备）
- 增强错误处理和返回信息

### v1.0.0 (2024-11-XX)
- 初始版本发布
- 支持两阶段口腔疾病识别
- Mouth区域检测 + 乳牙滞留分类
