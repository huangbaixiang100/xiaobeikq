# 我的H5网页项目 🚀

欢迎来到H5网页开发教程！这是一个完整的入门项目，帮助你从零开始创建一个现代化的网页。

## 📚 完整教程

### 第一步：了解项目结构

```
制作网页/
├── index.html    # 主HTML文件（网页的骨架）
├── style.css     # 样式文件（网页的外观）
├── script.js     # JavaScript文件（网页的交互功能）
└── README.md     # 项目说明文档
```

### 第二步：运行你的网页

#### 方法1：直接打开（最简单）
1. 找到 `index.html` 文件
2. 双击文件，会自动在浏览器中打开
3. 完成！你现在可以看到网页了

#### 方法2：使用VS Code Live Server（推荐）
1. 安装 [Visual Studio Code](https://code.visualstudio.com/)
2. 在VS Code中安装 "Live Server" 扩展
3. 右键点击 `index.html`，选择 "Open with Live Server"
4. 网页会自动在浏览器中打开，并且支持实时预览

#### 方法3：使用Python简易服务器
```bash
# 在项目文件夹中打开命令行，运行：
python -m http.server 8000
# 然后在浏览器中访问：http://localhost:8000
```

### 第三步：理解代码结构

#### HTML (index.html)
HTML是网页的骨架，定义了网页的内容和结构：
- `<nav>` - 导航栏
- `<section>` - 页面各个部分
- `<header>`, `<footer>` - 页眉和页脚
- `<div>` - 容器元素

#### CSS (style.css)
CSS负责网页的样式和外观：
- 颜色、字体、大小
- 布局（Flexbox、Grid）
- 动画效果
- 响应式设计（适配不同设备）

#### JavaScript (script.js)
JavaScript让网页具有交互性：
- 菜单切换
- 表单验证
- 滚动效果
- 动态内容

### 第四步：使用GitHub托管

#### 1. 安装Git
- Windows: 下载 [Git for Windows](https://git-scm.com/download/win)
- Mac: 打开终端，输入 `git --version`（如未安装会自动提示安装）

#### 2. 创建GitHub账号
访问 [GitHub.com](https://github.com) 注册账号

#### 3. 创建仓库
1. 登录GitHub
2. 点击右上角 "+" → "New repository"
3. 填写仓库名称（如：my-h5-website）
4. 选择 "Public"（公开）
5. 点击 "Create repository"

#### 4. 上传代码到GitHub
在项目文件夹中打开命令行（Git Bash或PowerShell），运行以下命令：

```bash
# 初始化Git仓库
git init

# 添加所有文件
git add .

# 提交文件
git commit -m "初始提交：创建H5网页"

# 连接到你的GitHub仓库（替换YOUR_USERNAME和YOUR_REPO）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 推送代码到GitHub
git branch -M main
git push -u origin main
```

#### 5. 使用GitHub Pages发布网站

1. 在GitHub仓库页面，点击 "Settings"
2. 在左侧菜单找到 "Pages"
3. 在 "Source" 下拉菜单中选择 "main" 分支
4. 点击 "Save"
5. 等待几分钟，你的网站就会发布到：
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

### 第五步：自定义你的网页

#### 修改文字内容
打开 `index.html`，找到你想修改的文字，直接修改即可。

#### 修改颜色
打开 `style.css`，在文件开头找到：
```css
:root {
    --primary-color: #6366f1;  /* 主色调 */
    --secondary-color: #8b5cf6; /* 辅助色 */
}
```
修改这些颜色代码即可改变整个网站的配色。

#### 添加图片
1. 在项目文件夹中创建 `images` 文件夹
2. 将图片放入该文件夹
3. 在HTML中使用：
```html
<img src="images/your-image.jpg" alt="描述">
```

### 第六步：更新代码到GitHub

每次修改代码后，运行以下命令更新到GitHub：

```bash
git add .
git commit -m "描述你做的修改"
git push
```

等待几分钟，GitHub Pages上的网站就会自动更新。

## 🎨 网页特性

- ✅ 响应式设计（自动适配手机、平板、电脑）
- ✅ 现代化UI设计
- ✅ 流畅的动画效果
- ✅ 移动端菜单
- ✅ 表单验证
- ✅ 返回顶部按钮
- ✅ 平滑滚动
- ✅ 无需任何框架

## 🛠️ 技术栈

- HTML5
- CSS3 (Flexbox, Grid, 动画)
- 原生JavaScript (ES6+)

## 📱 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge
- 现代移动浏览器

## 💡 学习资源

### 推荐网站
- [MDN Web Docs](https://developer.mozilla.org/zh-CN/) - 权威的Web开发文档
- [W3School](https://www.w3school.com.cn/) - 中文教程
- [菜鸟教程](https://www.runoob.com/) - 入门教程

### 推荐工具
- [Visual Studio Code](https://code.visualstudio.com/) - 代码编辑器
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - 浏览器开发工具
- [Can I Use](https://caniuse.com/) - 检查浏览器兼容性

## 🎯 下一步学习

1. **学习JavaScript框架**
   - React
   - Vue
   - Angular

2. **学习后端开发**
   - Node.js
   - Python (Django/Flask)
   - PHP

3. **学习数据库**
   - MySQL
   - MongoDB
   - PostgreSQL

4. **学习版本控制**
   - Git进阶
   - GitHub协作

## ❓ 常见问题

### 1. 网页样式显示不正常？
- 确保 `style.css` 和 `index.html` 在同一文件夹
- 检查浏览器控制台是否有错误（F12打开）

### 2. JavaScript功能不工作？
- 确保 `script.js` 和 `index.html` 在同一文件夹
- 检查浏览器控制台是否有错误

### 3. GitHub Pages显示404？
- 确保仓库是公开的（Public）
- 确保在Settings→Pages中正确设置了分支
- 等待几分钟让GitHub处理

### 4. 如何添加更多页面？
创建新的HTML文件（如 `about.html`），然后在导航栏中添加链接：
```html
<li><a href="about.html">关于页面</a></li>
```

## 📞 需要帮助？

如果遇到问题，可以：
1. 查看浏览器控制台的错误信息（F12）
2. 搜索错误信息
3. 在GitHub Issues中提问
4. 访问相关技术论坛

## 📝 许可证

本项目采用 MIT 许可证，可以自由使用和修改。

---

**祝你学习愉快！🎉**

记住：每个优秀的开发者都是从零开始的。不要害怕犯错，多实践、多尝试！

