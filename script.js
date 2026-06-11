// API配置
// 部署在 Vercel 时留空即可（同源请求）。本地用 file:// 或静态服务器打开时，
// 请改为你的 Vercel 部署地址，例如：'https://你的项目.vercel.app'
const API_BASE_URL = '';

// 全局变量
let selectedFile = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeDragAndDrop();
});

// 初始化事件监听器
function initializeEventListeners() {
    console.log('初始化事件监听器');
    
    // 文件输入变化
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        console.log('找到文件输入元素');
        imageInput.addEventListener('change', handleFileSelect);
    } else {
        console.error('未找到文件输入元素');
    }
    
    // 选择图片按钮
    const selectImageBtn = document.getElementById('selectImageBtn');
    if (selectImageBtn) {
        selectImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('选择图片按钮点击');
            const imageInput = document.getElementById('imageInput');
            if (imageInput) {
                imageInput.click();
            }
        });
        console.log('选择图片按钮事件已绑定');
    }
    
    // 导航菜单
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            animateHamburger();
        });

        // 点击菜单项关闭菜单
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                resetHamburger();
            });
        });
    }

    // 导航高亮
    initNavHighlight();
}

// 初始化拖拽上传
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    
    if (!uploadArea) {
        console.error('未找到上传区域元素');
        return;
    }
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    // 点击上传区域触发文件选择（除了按钮）
    uploadArea.addEventListener('click', (e) => {
        // 如果点击的是按钮或者按钮的子元素，不处理
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.id === 'selectImageBtn') {
            console.log('点击了按钮，跳过上传区域事件');
            return;
        }
        console.log('点击了上传区域');
        const imageInput = document.getElementById('imageInput');
        if (imageInput) {
            imageInput.click();
        }
    });
}

// 处理文件选择
function handleFileSelect(event) {
    console.log('文件选择事件触发');
    const file = event.target.files[0];
    if (file) {
        console.log('选择的文件:', file.name);
        handleFile(file);
    } else {
        console.log('没有选择文件');
    }
}

// 处理文件
function handleFile(file) {
    console.log('处理文件:', file.name, '类型:', file.type, '大小:', file.size);
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        console.error('文件类型错误:', file.type);
        showError('请选择图片文件（JPG、PNG等格式）');
        return;
    }
    
    // 验证文件大小（限制为10MB）
    if (file.size > 10 * 1024 * 1024) {
        console.error('文件过大:', file.size);
        showError('图片文件过大，请选择小于10MB的图片');
        return;
    }
    
    console.log('文件验证通过，开始处理');
    selectedFile = file;
    showImagePreview(file);
}

// 显示图片预览
function showImagePreview(file) {
    console.log('开始预览图片');
    const reader = new FileReader();
    
    reader.onload = function(e) {
        console.log('图片加载完成');
        const previewImage = document.getElementById('previewImage');
        if (previewImage) {
            previewImage.src = e.target.result;
            
            // 显示预览区域
            const previewArea = document.getElementById('imagePreview');
            const uploadArea = document.getElementById('uploadArea');
            
            console.log('显示预览区域');
            // 确保元素存在
            if (previewArea && uploadArea) {
                previewArea.style.display = 'block';
                uploadArea.style.display = 'none';
                previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                console.error('预览区域或上传区域元素未找到');
                console.log('previewArea:', previewArea);
                console.log('uploadArea:', uploadArea);
            }
            
            // 确保图片显示
            previewImage.style.display = 'block';
            previewImage.style.maxWidth = '100%';
            previewImage.style.height = 'auto';
            console.log('预览图片已设置');
        } else {
            console.error('未找到预览图片元素');
        }
    };
    
    reader.onerror = function(error) {
        console.error('图片加载错误:', error);
        showError('图片加载失败，请重试');
    };
    
    try {
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('读取文件错误:', error);
        showError('读取文件失败，请重试');
    }
}

// 分析图片
async function analyzeImage() {
    if (!selectedFile) {
        showError('请先选择图片');
        return;
    }
    
    showLoadingState();
    console.log('开始分析图片...');
    
    try {
        // 创建FormData
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const analyzeUrl = `${API_BASE_URL}/api/analyze?save_image_flag=true&include_heatmap=true`;
        console.log('正在上传图片到:', analyzeUrl);
        
        // 调用API进行分析
        const response = await fetch(analyzeUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('API响应:', result);
        
        if (result.success) {
            console.log('分析成功，显示结果');
            showAnalysisResult(result);
        } else {
            console.error('分析失败:', result.message);
            showError(result.message || '分析失败，请重试');
        }
        
    } catch (error) {
        console.error('分析错误:', error);
        const errorMsg = error.message || '网络错误';
        // 检查是否是混合内容错误
        if (window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:')) {
            showError('安全连接失败。请尝试使用 HTTP 访问网站：' + window.location.href.replace('https:', 'http:'));
        } else if (errorMsg === 'Failed to fetch' || error.name === 'TypeError') {
            const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' && !API_BASE_URL;
            showError(
                isLocal
                    ? '无法连接分析服务。请将网站部署到 Vercel 后使用，或在项目目录运行 vercel dev 进行本地测试。'
                    : '网络错误或服务不可用：' + errorMsg
            );
        } else {
            showError('网络错误或服务不可用：' + errorMsg);
        }
    }
}

// 显示分析结果
function showAnalysisResult(result) {
    hideAllStates();
    
    // 设置基本信息
    document.getElementById('classification').textContent = result.classification || '未知';
    document.getElementById('confidence').textContent = 
        result.probability ? `${(result.probability * 100).toFixed(2)}%` : 'N/A';
    
    // 打印完整结果以便调试
    console.log('API返回结果:', result);
    
    // 设置模型预测结果（热力图）
    const heatmapImage = document.getElementById('heatmapImage');
    const heatmapPlaceholder = document.getElementById('heatmapPlaceholder');
    
    if (heatmapImage && heatmapPlaceholder) {
        if (result.stage2_heatmap_base64) {
            heatmapImage.src = 'data:image/jpeg;base64,' + result.stage2_heatmap_base64;
            heatmapImage.style.display = 'block';
            heatmapPlaceholder.style.display = 'none';
            console.log('设置了热力图图片');
        } else {
            console.log('未找到热力图数据');
            heatmapImage.style.display = 'none';
            heatmapPlaceholder.style.display = 'block';
            if (!result.mouth_detected) {
                heatmapPlaceholder.textContent = '未检测到口腔区域，无法生成热力图';
            } else {
                heatmapPlaceholder.textContent = '暂无热力图数据';
            }
        }
    } else {
        console.error('未找到热力图元素');
    }
    
    const mouthImage = document.getElementById('mouthImage');
    if (mouthImage) {
        if (result.cropped_mouth_image_base64) {
            mouthImage.src = 'data:image/jpeg;base64,' + result.cropped_mouth_image_base64;
            console.log('设置了口腔区域图片');
        } else {
            console.log('未找到口腔区域图片');
            mouthImage.style.display = 'none';
            const container = mouthImage.parentElement;
            if (container) {
                const infoDiv = document.createElement('div');
                infoDiv.className = 'mouth-info';
                infoDiv.innerHTML = `
            <div class="info-item">
                <span class="info-label">检测状态：</span>
                <span class="info-value error">未检测到口腔区域</span>
            </div>
            <div class="info-item">
                <span class="info-label">建议：</span>
                <span class="info-value">请重新拍摄，确保口腔区域清晰可见</span>
            </div>
        `;
                container.appendChild(infoDiv);
            }
        }
    }
    
    // 设置建议
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';
    if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recommendationsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '暂无特殊建议，请保持口腔卫生';
        recommendationsList.appendChild(li);
    }
    
    // 根据检测结果设置样式
    const classificationElement = document.getElementById('classification');
    if (result.classification === '乳牙滞留') {
        classificationElement.className = 'classification';
    } else {
        classificationElement.className = 'classification normal';
    }
    
    // 显示结果
    document.getElementById('modelPrediction').style.display = 'block';
    document.getElementById('analysisResult').style.display = 'block';
}

// 评估图片质量
function assessQuality(sharpness, exposure) {
    if (!sharpness || !exposure) return '未知';
    
    let quality = '优秀';
    const issues = [];
    
    // 评估清晰度
    if (sharpness < 100) {
        issues.push('模糊');
    } else if (sharpness < 200) {
        issues.push('清晰度一般');
    }
    
    // 评估曝光度
    if (exposure < 50) {
        issues.push('过暗');
    } else if (exposure > 200) {
        issues.push('过亮');
    }
    
    if (issues.length > 1) {
        quality = '需要改善';
    } else if (issues.length === 1) {
        quality = '良好';
    }
    
    return quality;
}

// 显示加载状态
function showLoadingState() {
    hideAllStates();
    document.getElementById('loadingState').style.display = 'block';
}

// 显示错误信息
function showError(message) {
    hideAllStates();
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'block';
}

// 隐藏所有状态
function hideAllStates() {
    console.log('隐藏所有状态');
    const states = ['loadingState', 'modelPrediction', 'analysisResult', 'errorMessage'];
    states.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
            console.log(`隐藏 ${id}`);
        }
    });
}

// 重置上传
function resetUpload() {
    console.log('开始重置上传状态');
    
    // 重置文件选择
    selectedFile = null;
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.value = '';
    }
    
    // 显示上传区域
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.style.display = 'block';
        uploadArea.style.opacity = '1';
        uploadArea.style.visibility = 'visible';
        console.log('上传区域已显示');
    }
    
    // 隐藏预览区域
    const previewArea = document.getElementById('imagePreview');
    if (previewArea) {
        previewArea.style.display = 'none';
        // 重置预览图片
        const previewImage = document.getElementById('previewImage');
        if (previewImage) {
            previewImage.src = '';
            previewImage.style.display = 'none';
        }
    }
    
    // 隐藏所有状态
    hideAllStates();
    
    // 重置口腔图片和信息
    const mouthImage = document.getElementById('mouthImage');
    if (mouthImage && mouthImage.parentElement) {
        mouthImage.src = '';
        mouthImage.style.display = 'none';
        const mouthInfo = mouthImage.parentElement.querySelector('.mouth-info');
        if (mouthInfo) {
            mouthInfo.remove();
        }
    }
    
    // 重置分析结果区域
    const analysisResult = document.getElementById('analysisResult');
    if (analysisResult) {
        analysisResult.style.display = 'none';
    }

    const modelPrediction = document.getElementById('modelPrediction');
    if (modelPrediction) {
        modelPrediction.style.display = 'none';
    }

    const heatmapImage = document.getElementById('heatmapImage');
    const heatmapPlaceholder = document.getElementById('heatmapPlaceholder');
    if (heatmapImage) {
        heatmapImage.src = '';
        heatmapImage.style.display = 'none';
    }
    if (heatmapPlaceholder) {
        heatmapPlaceholder.textContent = '暂无热力图数据';
        heatmapPlaceholder.style.display = 'none';
    }
    
    // 重置错误信息
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
    
    // 重置加载状态
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
    
    // 确保上传区域中的按钮可点击
    const uploadButton = uploadArea.querySelector('button');
    if (uploadButton) {
        uploadButton.style.pointerEvents = 'auto';
        uploadButton.style.opacity = '1';
    }
    
    console.log('重置上传状态完成');
}

// 滚动到指定部分
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// 汉堡菜单动画
function animateHamburger() {
    const spans = document.querySelectorAll('.hamburger span');
    const navMenu = document.querySelector('.nav-menu');
    
    spans.forEach((span, index) => {
        if (navMenu.classList.contains('active')) {
            if (index === 0) span.style.transform = 'rotate(45deg) translate(5px, 5px)';
            if (index === 1) span.style.opacity = '0';
            if (index === 2) span.style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            span.style.transform = 'none';
            span.style.opacity = '1';
        }
    });
}

// 重置汉堡菜单
function resetHamburger() {
    const spans = document.querySelectorAll('.hamburger span');
    spans.forEach(span => {
        span.style.transform = 'none';
        span.style.opacity = '1';
    });
}

// 处理联系表单
function handleContactForm(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // 验证表单
    if (!name || !email || !message) {
        showFormMessage('请填写所有字段', 'error');
        return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showFormMessage('请输入有效的邮箱地址', 'error');
        return;
    }
    
    // 模拟提交（实际项目中这里应该发送到服务器）
    showFormMessage('消息发送成功！我们会尽快回复您。', 'success');
    document.getElementById('contactForm').reset();
    
    console.log('联系表单数据:', { name, email, message });
}

// 显示表单消息
function showFormMessage(text, type) {
    const formMessage = document.getElementById('formMessage');
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    
    setTimeout(() => {
        formMessage.style.display = 'none';
        formMessage.className = 'form-message';
    }, 5000);
}

// 导航栏滚动阴影
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    navbar.style.boxShadow = window.pageYOffset > 50
        ? '0 2px 12px rgba(0, 0, 0, 0.1)'
        : '0 1px 4px rgba(0, 0, 0, 0.04)';
});

// 导航链接高亮
function initNavHighlight() {
    const sections = document.querySelectorAll('#home, #upload, #contact');
    const navLinks = document.querySelectorAll('.nav-link');

    function updateActive() {
        let current = 'home';
        const scrollY = window.pageYOffset + 100;

        sections.forEach(section => {
            if (scrollY >= section.offsetTop) {
                current = section.id;
            }
        });

        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + current);
        });
    }

    window.addEventListener('scroll', updateActive);
    updateActive();
}

// 特色卡片动画
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.why-card, .process-step').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'all 0.6s ease';
    observer.observe(card);
});

// 添加回到顶部按钮
window.addEventListener('load', () => {
    const scrollTopBtn = document.createElement('button');
    scrollTopBtn.innerHTML = '↑';
    scrollTopBtn.className = 'scroll-top-btn';
    scrollTopBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #2E7D32, #4CAF50);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 1.5rem;
        cursor: pointer;
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 999;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    `;
    
    document.body.appendChild(scrollTopBtn);
    
    // 显示/隐藏回到顶部按钮
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollTopBtn.style.opacity = '1';
            scrollTopBtn.style.pointerEvents = 'auto';
        } else {
            scrollTopBtn.style.opacity = '0';
            scrollTopBtn.style.pointerEvents = 'none';
        }
    });
    
    // 点击回到顶部
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // 悬停效果
    scrollTopBtn.addEventListener('mouseenter', () => {
        scrollTopBtn.style.transform = 'scale(1.1)';
    });
    
    scrollTopBtn.addEventListener('mouseleave', () => {
        scrollTopBtn.style.transform = 'scale(1)';
    });
});

// 打印欢迎消息
console.log('%c🦷 欢迎使用小北儿童口腔疾病识别系统！', 'color: #2E7D32; font-size: 20px; font-weight: bold;');
console.log('%c这是一个专业的AI口腔检测系统', 'color: #4CAF50; font-size: 14px;');
console.log('%c请确保API服务已启动: ' + API_BASE_URL, 'color: #FF9800; font-size: 12px;');
