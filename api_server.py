#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
乳牙滞留识别API服务
提供两阶段检测接口：
1. Mouth区域检测
2. Disease区域检测 + 分类
"""
import io
import base64
import numpy as np
from pathlib import Path
from PIL import Image
from typing import Optional, List, Dict, Any
import torch
import torch.nn as nn
from torchvision import models, transforms
from ultralytics import YOLO
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import torch.serialization
import cv2
from datetime import datetime

# 临时取消代理
os.environ['http_proxy'] = ''
os.environ['https_proxy'] = ''
os.environ['HTTP_PROXY'] = ''
os.environ['HTTPS_PROXY'] = ''

# ==================== 配置 ====================
MOUTH_MODEL_PATH = Path('/home/xiaobei/hbx/乳牙滞留识别/models/mouth_detection/best.pt')
CLASSIFIER_MODEL_PATH = Path('/home/xiaobei/hbx/乳牙滞留识别/results_101_resnet34_5fold/fold_3_best.pth')

# 图片保存路径
SAVE_IMAGE_DIR = Path('/data/xiaobei/hbx/picture')

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

# 分类类别
CLASS_NAMES = ['非乳牙滞留', '乳牙滞留']

# ==================== API响应模型 ====================
class BoundingBox(BaseModel):
    """边界框"""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_name: str

class MouthDetectionResponse(BaseModel):
    """Mouth检测响应"""
    success: bool
    message: str
    mouth_detected: bool
    mouth_box: Optional[BoundingBox] = None
    cropped_image_base64: Optional[str] = None

class ClassificationResponse(BaseModel):
    """分类响应"""
    success: bool
    message: str
    classification: str  # "乳牙滞留" 或 "非乳牙滞留"
    probability: float  # 预测类别的概率
    probabilities: Dict[str, float]  # 所有类别的概率分布

class CompleteAnalysisResponse(BaseModel):
    """完整分析响应"""
    success: bool
    message: str
    # 阶段1: Mouth检测
    mouth_detected: bool
    mouth_box: Optional[BoundingBox] = None
    # 阶段2: 分类
    classification: str  # "乳牙滞留" 或 "非乳牙滞留"
    probability: float  # 预测类别的概率
    probabilities: Dict[str, float]  # 所有类别的概率分布
    # 可视化结果（base64编码的图像）
    cropped_mouth_image_base64: Optional[str] = None
    # 建议
    recommendations: List[str]
    # 图片质量指标
    sharpness: Optional[float] = None  # 拉普拉斯方差（清晰度）
    exposure: Optional[float] = None  # 曝光度（平均亮度）
    # 保存状态
    image_saved: Optional[bool] = None
    saved_image_path: Optional[str] = None

class ImageQualityResponse(BaseModel):
    """图片质量检测响应"""
    success: bool
    message: str
    sharpness: float  # 拉普拉斯方差
    exposure: float  # 曝光度
    quality_assessment: str  # 质量评估
    recommendations: List[str]

# ==================== 初始化FastAPI ====================
app = FastAPI(
    title="小北儿童口腔疾病识别API",
    description="基于YOLOv11的两阶段乳牙滞留识别系统",
    version="1.0.0"
)

# 配置CORS（允许前端跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境建议设置具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 全局模型加载 ====================
print("正在加载模型...")
mouth_model = None
classifier_model = None
transform = None

def create_classifier_model():
    """创建ResNet34分类模型"""
    model = models.resnet34(weights=None)
    
    # 修改最后的全连接层（与训练时保持一致）
    num_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Linear(num_features, 256),
        nn.ReLU(),
        nn.Dropout(0.5),
        nn.Linear(256, 2)
    )
    
    return model

@app.on_event("startup")
async def load_models():
    """启动时加载模型"""
    global mouth_model, classifier_model, transform
    
    try:
        print(f"加载Mouth检测模型: {MOUTH_MODEL_PATH}")
        mouth_model = YOLO(str(MOUTH_MODEL_PATH))
        
        print(f"加载分类模型: {CLASSIFIER_MODEL_PATH}")
        classifier_model = create_classifier_model()
        
        # 加载模型权重（禁用weights_only以兼容旧版本PyTorch保存的模型）
        # PyTorch 2.8.0默认启用了weights_only=True，需要显式设置为False
        checkpoint = torch.load(str(CLASSIFIER_MODEL_PATH), map_location=DEVICE, weights_only=False)
        
        # 检查checkpoint格式，提取model_state_dict
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            # 训练时保存的完整checkpoint，包含fold、accuracy等信息
            state_dict = checkpoint['model_state_dict']
            print(f"加载fold {checkpoint.get('fold', 'N/A')}的模型，验证准确率: {checkpoint.get('val_accuracy', 'N/A')}")
        else:
            # 直接保存的模型权重
            state_dict = checkpoint
            
        classifier_model.load_state_dict(state_dict)
            
        classifier_model = classifier_model.to(DEVICE)
        classifier_model.eval()
        
        # 定义图像预处理（与训练时保持一致）
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        # 确保图片保存目录存在
        SAVE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        print(f"图片保存目录: {SAVE_IMAGE_DIR}")
        
        print(f"模型加载完成！使用设备: {DEVICE}")
    except Exception as e:
        print(f"模型加载失败: {e}")
        import traceback
        traceback.print_exc()
        raise

# ==================== 辅助函数 ====================
def load_image_from_bytes(image_bytes: bytes) -> Image.Image:
    """从字节数据加载图像"""
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的图像格式: {str(e)}")

def image_to_base64(image: Image.Image) -> str:
    """将PIL图像转换为base64字符串"""
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG", quality=95)
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return img_str

def detect_mouth(image: Image.Image) -> tuple:
    """
    检测mouth区域
    返回: (success, cropped_image, box_info)
    """
    try:
        results = mouth_model(image, conf=0.25, verbose=False)
        
        if len(results) == 0 or len(results[0].boxes) == 0:
            return False, None, None
        
        # 获取最高置信度的检测框
        boxes = results[0].boxes
        best_idx = torch.argmax(boxes.conf).item()
        best_box = boxes.xyxy[best_idx].cpu().numpy()
        confidence = float(boxes.conf[best_idx].cpu().numpy())
        
        # 裁剪图像
        x1, y1, x2, y2 = map(int, best_box)
        
        # 添加边距
        margin_x = max(int((x2 - x1) * 0.1), 20)
        margin_y = max(int((y2 - y1) * 0.1), 20)
        
        x1_crop = max(0, x1 - margin_x)
        y1_crop = max(0, y1 - margin_y)
        x2_crop = min(image.width, x2 + margin_x)
        y2_crop = min(image.height, y2 + margin_y)
        
        cropped_image = image.crop((x1_crop, y1_crop, x2_crop, y2_crop))
        
        box_info = BoundingBox(
            x1=float(x1_crop),
            y1=float(y1_crop),
            x2=float(x2_crop),
            y2=float(y2_crop),
            confidence=confidence,
            class_name="mouth"
        )
        
        return True, cropped_image, box_info
        
    except Exception as e:
        print(f"Mouth检测错误: {e}")
        return False, None, None

def classify_image(image: Image.Image) -> tuple:
    """
    对mouth图像进行分类
    返回: (classification, probability, probabilities_dict)
    """
    try:
        # 预处理图像
        image_tensor = transform(image).unsqueeze(0).to(DEVICE)
        
        # 推理
        with torch.no_grad():
            outputs = classifier_model(image_tensor)
            probabilities = torch.softmax(outputs, dim=1)[0]
            predicted_class_idx = torch.argmax(probabilities).item()
            predicted_prob = probabilities[predicted_class_idx].item()
        
        # 获取所有类别的概率
        probabilities_dict = {
            CLASS_NAMES[i]: float(probabilities[i].cpu().numpy())
            for i in range(len(CLASS_NAMES))
        }
        
        classification = CLASS_NAMES[predicted_class_idx]
        
        return classification, predicted_prob, probabilities_dict
        
    except Exception as e:
        print(f"分类错误: {e}")
        return "未知", 0.0, {}

def calculate_sharpness(image: Image.Image) -> float:
    """
    计算图片的拉普拉斯方差（Laplacian Variance）
    用于衡量图片的清晰度，较高的方差通常意味着图片较清晰
    """
    # 将PIL图像转换为OpenCV格式
    img_array = np.array(image)
    # 转换为BGR格式（如果是RGB）
    if len(img_array.shape) == 3 and img_array.shape[2] == 3:
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    else:
        img_bgr = img_array
    
    # 转换为灰度图
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    # 计算拉普拉斯方差
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return float(laplacian_var)

def calculate_exposure(image: Image.Image) -> float:
    """
    计算图片曝光度（平均亮度）
    将图片转换为灰度图像，并计算平均亮度
    """
    # 将PIL图像转换为OpenCV格式
    img_array = np.array(image)
    # 转换为BGR格式（如果是RGB）
    if len(img_array.shape) == 3 and img_array.shape[2] == 3:
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    else:
        img_bgr = img_array
    
    # 转换为灰度图
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    # 计算平均亮度
    avg_brightness = np.mean(gray)
    return float(avg_brightness)

def save_image(image: Image.Image, save_dir: Path) -> tuple:
    """
    保存图片到指定路径
    返回: (success, saved_path)
    """
    try:
        # 生成时间戳
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"image_{timestamp}.jpg"
        save_path = save_dir / filename
        
        # 保存图片为JPEG格式
        image.save(save_path, format='JPEG', quality=95)
        
        return True, str(save_path)
    except Exception as e:
        print(f"保存图片失败: {e}")
        return False, None

def assess_image_quality(sharpness: float, exposure: float) -> tuple:
    """
    评估图片质量
    返回: (quality_level, recommendations)
    """
    recommendations = []
    quality_issues = []
    
    # 评估清晰度
    if sharpness < 100:
        quality_issues.append("图片模糊")
        recommendations.append("📸 图片较为模糊，建议重新拍摄更清晰的照片")
    elif sharpness < 200:
        quality_issues.append("清晰度一般")
        recommendations.append("📷 图片清晰度一般，建议提高拍摄稳定性")
    else:
        recommendations.append("✅ 图片清晰度良好")
    
    # 评估曝光度
    if exposure < 50:
        quality_issues.append("曝光不足")
        recommendations.append("💡 图片过暗，建议增加光照或提高曝光度")
    elif exposure > 200:
        quality_issues.append("曝光过度")
        recommendations.append("☀️ 图片过亮，建议降低光照或减少曝光度")
    elif exposure < 80 or exposure > 180:
        quality_issues.append("曝光欠佳")
        recommendations.append("🔆 曝光度欠佳，建议调整光线条件")
    else:
        recommendations.append("✅ 曝光度适中")
    
    # 综合评估
    if len(quality_issues) == 0:
        quality_level = "优秀"
    elif len(quality_issues) == 1:
        quality_level = "良好"
    else:
        quality_level = "需要改善"
    
    return quality_level, recommendations

def generate_recommendations(classification: str, probability: float) -> List[str]:
    """生成诊断建议"""
    recommendations = []
    
    if classification == "乳牙滞留":
        if probability >= 0.9:
            recommendations.append("⚠️ 高置信度检测到乳牙滞留，强烈建议尽快带孩子到口腔科就诊")
        else:
            recommendations.append("⚕️ 检测到乳牙滞留，建议带孩子到口腔科就诊确认")
        
        recommendations.append("🦷 可能需要拔除滞留的乳牙，以免影响恒牙生长")
        recommendations.append("⏰ 建议一周内就诊")
        recommendations.append("🍎 近期避免让孩子用力咬硬物")
        recommendations.append("🪥 保持口腔清洁，早晚刷牙")
    else:
        if probability < 0.6:
            recommendations.append("⚠️ 分类置信度较低，建议重新拍照或咨询专业医生")
            recommendations.append("📸 请确保图像清晰，光线充足")
        else:
            recommendations.append("✅ 暂未检测到明显的乳牙滞留")
            recommendations.append("👀 如有疑虑，建议定期口腔检查（每6个月）")
        recommendations.append("🪥 继续保持良好的口腔卫生习惯")
        recommendations.append("🥛 注意补充钙质，促进牙齿健康发育")
    
    return recommendations

# ==================== API端点 ====================

@app.get("/")
async def root():
    """API根路径"""
    return {
        "service": "小北儿童口腔疾病识别API",
        "version": "2.0.0",
        "status": "running",
        "device": DEVICE,
        "save_image_directory": str(SAVE_IMAGE_DIR),
        "endpoints": {
            "complete_analysis": "/api/v1/analyze (支持save_image_flag参数)",
            "mouth_detection": "/api/v1/detect-mouth",
            "classification": "/api/v1/classify",
            "quality_check": "/api/v1/quality-check (新增)",
            "health": "/health"
        },
        "new_features": [
            "图片保存功能 (save_image_flag参数)",
            "拉普拉斯方差计算 (清晰度检测)",
            "曝光度计算 (平均亮度)",
            "图片质量评估接口"
        ]
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "models_loaded": mouth_model is not None and classifier_model is not None,
        "device": DEVICE,
        "classifier_classes": CLASS_NAMES
    }

@app.post("/api/v1/detect-mouth", response_model=MouthDetectionResponse)
async def detect_mouth_endpoint(file: UploadFile = File(...)):
    """
    阶段1: Mouth区域检测
    
    上传口腔图像，返回mouth区域检测结果和裁剪后的图像
    """
    try:
        # 读取图像
        image_bytes = await file.read()
        image = load_image_from_bytes(image_bytes)
        
        # 检测mouth
        success, cropped_image, box_info = detect_mouth(image)
        
        if success:
            cropped_base64 = image_to_base64(cropped_image)
            return MouthDetectionResponse(
                success=True,
                message="Mouth区域检测成功",
                mouth_detected=True,
                mouth_box=box_info,
                cropped_image_base64=cropped_base64
            )
        else:
            return MouthDetectionResponse(
                success=False,
                message="未检测到mouth区域，请确保图像包含清晰的口腔部分",
                mouth_detected=False
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@app.post("/api/v1/classify", response_model=ClassificationResponse)
async def classify_endpoint(file: UploadFile = File(...)):
    """
    阶段2: 图像分类（需要先裁剪的mouth图像）
    
    上传裁剪后的mouth图像，返回分类结果和概率
    """
    try:
        # 读取图像
        image_bytes = await file.read()
        image = load_image_from_bytes(image_bytes)
        
        # 分类
        classification, probability, probabilities_dict = classify_image(image)
        
        return ClassificationResponse(
            success=True,
            message=f"分类完成: {classification}",
            classification=classification,
            probability=probability,
            probabilities=probabilities_dict
        )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@app.post("/api/v1/analyze", response_model=CompleteAnalysisResponse)
async def complete_analysis(
    file: UploadFile = File(...),
    save_image_flag: bool = Query(False, description="是否保存原始图片到服务器")
):
    """
    完整分析流程（推荐使用）
    
    上传原始口腔图像，自动完成两阶段处理：
    1. Mouth区域检测和裁剪
    2. 图像分类（乳牙滞留 vs 非乳牙滞留）
    
    参数:
    - file: 上传的图片文件
    - save_image_flag: 是否保存原始图片（默认False）
    
    返回完整的分析结果和建议
    """
    try:
        # 读取图像
        image_bytes = await file.read()
        image = load_image_from_bytes(image_bytes)
        
        # 保存图片（如果需要）
        image_saved = False
        saved_path = None
        if save_image_flag:
            image_saved, saved_path = save_image(image, SAVE_IMAGE_DIR)
        
        # 计算图片质量指标
        sharpness = calculate_sharpness(image)
        exposure = calculate_exposure(image)
        
        # 阶段1: Mouth检测
        success, cropped_image, mouth_box = detect_mouth(image)
        
        if not success:
            return CompleteAnalysisResponse(
                success=False,
                message="未检测到mouth区域，请上传包含清晰口腔的图像",
                mouth_detected=False,
                classification="未知",
                probability=0.0,
                probabilities={},
                recommendations=["📸 请重新拍照，确保图像包含清晰的口腔部分"],
                sharpness=sharpness,
                exposure=exposure,
                image_saved=image_saved,
                saved_image_path=saved_path
            )
        
        # 阶段2: 分类
        classification, probability, probabilities_dict = classify_image(cropped_image)
        
        # 转换裁剪后的图像为base64
        cropped_base64 = image_to_base64(cropped_image)
        
        # 生成建议
        recommendations = generate_recommendations(classification, probability)
        
        return CompleteAnalysisResponse(
            success=True,
            message="分析完成",
            mouth_detected=True,
            mouth_box=mouth_box,
            classification=classification,
            probability=probability,
            probabilities=probabilities_dict,
            cropped_mouth_image_base64=cropped_base64,
            recommendations=recommendations,
            sharpness=sharpness,
            exposure=exposure,
            image_saved=image_saved,
            saved_image_path=saved_path
        )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@app.post("/api/v1/quality-check", response_model=ImageQualityResponse)
async def check_image_quality(file: UploadFile = File(...)):
    """
    图片质量检测
    
    上传图片，检测其清晰度和曝光度，并给出质量评估
    
    返回:
    - sharpness: 拉普拉斯方差（清晰度指标）
    - exposure: 平均亮度（曝光度指标）
    - quality_assessment: 质量评估等级
    - recommendations: 改善建议
    """
    try:
        # 读取图像
        image_bytes = await file.read()
        image = load_image_from_bytes(image_bytes)
        
        # 计算质量指标
        sharpness = calculate_sharpness(image)
        exposure = calculate_exposure(image)
        
        # 评估质量
        quality_level, recommendations = assess_image_quality(sharpness, exposure)
        
        return ImageQualityResponse(
            success=True,
            message=f"图片质量检测完成，质量等级: {quality_level}",
            sharpness=sharpness,
            exposure=exposure,
            quality_assessment=quality_level,
            recommendations=recommendations
        )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

# ==================== 主函数 ====================
if __name__ == "__main__":
    import os
    port = int(os.environ.get("API_PORT", 15025))  # 默认1001端口
    
    uvicorn.run(
        "api_service:app",
        host="0.0.0.0",  # 监听所有网络接口
        port=port,
        reload=False,  # 生产环境设为False
        workers=1  # 可根据服务器配置调整
    )

