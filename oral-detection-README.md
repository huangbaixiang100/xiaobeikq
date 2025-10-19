# 小北儿童口腔疾病识别系统 🦷

一个专业的AI驱动的口腔健康检测网页应用，专门用于识别儿童乳牙滞留等口腔疾病。

## 📋 项目特性

- ✅ **AI智能检测** - 基于深度学习模型的口腔疾病识别
- ✅ **图片上传** - 支持拖拽上传和点击选择
- ✅ **实时分析** - 快速返回检测结果和专业建议
- ✅ **图片保存** - 自动保存原始图片到服务器（`save_image_flag=true`）
- ✅ **质量检测** - 自动评估图片清晰度和曝光度
- ✅ **响应式设计** - 完美适配手机、平板、电脑
- ✅ **专业UI** - 医疗主题的现代化界面设计

## 🚀 快速开始

### 1. 启动API服务

确保你的口腔检测API服务已启动：

```bash
# 启动API服务
bash /home/xiaobei/hbx/乳牙滞留识别/start_api.sh
# 或手动启动
conda activate AgenticRAG
cd /home/xiaobei/hbx/乳牙滞留识别
python api_service.py
```

### 2. 配置API地址

在 `oral-detection-script.js` 文件中修改API地址：

```javascript
const API_BASE_URL = 'http://localhost:15025'; // 修改为你的API地址
```

### 3. 运行网页

#### 方式1：直接打开
双击 `oral-detection.html` 文件即可在浏览器中打开

#### 方式2：使用Live Server（推荐）
1. 在VS Code中安装"Live Server"扩展
2. 右键点击 `oral-detection.html`，选择"Open with Live Server"

## 📁 文件结构

```
制作网页/
├── oral-detection.html          # 主HTML文件
├── oral-detection-style.css     # 样式文件
├── oral-detection-script.js     # JavaScript功能文件
└── README.md                   # 项目说明
```

## 🔌 API集成

### 使用的API接口

1. **完整分析接口**
   ```
   POST /api/v1/analyze?save_image_flag=true
   ```
   - 上传原始口腔图像
   - 自动完成两阶段检测
   - 保存原始图片到服务器
   - 返回检测结果和质量评估

### API响应处理

系统会自动处理以下API响应字段：

- `classification` - 检测结果（乳牙滞留/非乳牙滞留）
- `confidence` - 置信度
- `sharpness` - 图片清晰度
- `exposure` - 图片曝光度
- `recommendations` - 专业建议
- `annotated_image_base64` - 标注后的图像
- `image_saved` - 图片是否已保存

## 🎨 界面功能

### 上传区域
- 支持拖拽上传
- 支持点击选择文件
- 文件类型验证（仅图片）
- 文件大小限制（10MB）

### 图片预览
- 实时预览上传的图片
- 开始分析按钮
- 重新选择功能

### 分析结果
- **检测结果** - 显示分类和置信度
- **图片质量** - 清晰度和曝光度评估
- **专业建议** - 基于检测结果的医疗建议
- **图像对比** - 原始图像和检测结果对比
- **保存状态** - 显示图片是否已保存到服务器

## 🛠️ 技术栈

- **HTML5** - 语义化标记
- **CSS3** - 现代化样式和动画
- **JavaScript (ES6+)** - 交互功能和API调用
- **Fetch API** - 异步数据请求
- **File API** - 文件上传处理

## 📱 响应式设计

- **桌面端** - 完整功能展示
- **平板端** - 适配中等屏幕
- **手机端** - 移动端优化布局

## 🔧 自定义配置

### 修改API地址
```javascript
// 在 oral-detection-script.js 中修改
const API_BASE_URL = 'http://your-api-server:port';
```

### 修改文件大小限制
```javascript
// 在 handleFile 函数中修改
if (file.size > 10 * 1024 * 1024) { // 10MB限制
    showError('图片文件过大，请选择小于10MB的图片');
    return;
}
```

### 修改主题颜色
```css
/* 在 oral-detection-style.css 中修改 */
:root {
    --primary-color: #2E7D32;    /* 主色调 */
    --secondary-color: #4CAF50;  /* 辅助色 */
    --accent-color: #81C784;     /* 强调色 */
}
```

## 🌐 部署到GitHub Pages

### 1. 上传到GitHub

```bash
# 初始化Git仓库
git init

# 添加文件
git add .

# 提交
git commit -m "添加小北口腔检测系统"

# 连接到GitHub仓库
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 推送代码
git branch -M main
git push -u origin main
```

### 2. 启用GitHub Pages

1. 在GitHub仓库页面点击 **Settings**
2. 找到左侧的 **Pages**
3. 在"Source"中选择 **main** 分支
4. 点击 **Save**
5. 等待几分钟，访问：`https://你的用户名.github.io/你的仓库名/oral-detection.html`

## ⚠️ 注意事项

### API服务要求
- 确保API服务已启动并可访问
- 检查CORS设置（如果需要跨域访问）
- 验证API接口地址和端口

### 浏览器兼容性
- Chrome (推荐)
- Firefox
- Safari
- Edge
- 现代移动浏览器

### 文件限制
- 支持格式：JPG、PNG、GIF等图片格式
- 文件大小：最大10MB
- 建议图片清晰、光线充足

## 🐛 常见问题

### Q: 上传图片后没有反应？
A: 检查以下几点：
1. 确保选择了有效的图片文件
2. 检查文件大小是否超过10MB
3. 查看浏览器控制台是否有错误信息

### Q: API调用失败？
A: 检查以下几点：
1. API服务是否已启动
2. API地址是否正确
3. 网络连接是否正常
4. 查看浏览器控制台的错误信息

### Q: 图片质量评估不准确？
A: 建议：
1. 确保图片清晰，避免模糊
2. 保持适当的光线，避免过暗或过亮
3. 避免手抖，保持拍摄稳定

## 📞 技术支持

如有问题或建议，请联系：

- 📧 Email: support@xiaobei-dental.com
- 📞 电话: 400-123-4567

## 📄 许可证

本项目采用 MIT 许可证，可自由使用和修改。

---

**🦷 让AI技术守护儿童口腔健康！**
