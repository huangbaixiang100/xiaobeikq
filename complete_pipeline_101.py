#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整的两阶段乳牙滞留识别流程：
阶段1: Mouth检测 (YOLOv11-small)
阶段2: Disease区域检测 + 图像分类 (YOLOv11-small)
"""

import torch
import json
import shutil
import numpy as np
from pathlib import Path
from PIL import Image
from ultralytics import YOLO
from tqdm import tqdm
from sklearn.model_selection import KFold
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score

# ==================== 配置参数 ====================
# 路径配置
ORIGINAL_DIR = Path('/home/xiaobei/hbx/乳牙滞留识别/乳牙滞留识别101')
CROPPED_DIR = Path('/home/xiaobei/hbx/乳牙滞留识别/乳牙滞留识别101_cropped')
DETECTION_DATA_DIR = Path('/home/xiaobei/hbx/乳牙滞留识别/detection_dataset_101')
OUTPUT_DIR = Path('/home/xiaobei/hbx/乳牙滞留识别/complete_results_101')

# 模型路径
MOUTH_MODEL_PATH = Path('/home/xiaobei/hbx/乳牙滞留识别/models/mouth_detection/best.pt')
YOLO_PRETRAINED = Path('/home/xiaobei/hbx/乳牙滞留识别/yolo11s.pt')

# 训练配置
IMAGE_SIZE = 640
N_FOLDS = 5
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# 疾病标签定义
DISEASE_LABELS = {'disease_area', 'disease area', 'Disease area', 'Disease_area', 'diaease_area'}

# 创建输出目录
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DETECTION_DATA_DIR.mkdir(parents=True, exist_ok=True)

print(f"使用设备: {DEVICE}")
print(f"原始数据集: {ORIGINAL_DIR}")
print(f"输出目录: {OUTPUT_DIR}")


# ==================== 阶段1: Mouth检测和裁剪 ====================
def stage1_crop_mouths():
    """阶段1: 使用训练好的mouth检测模型裁剪图像，并保存裁剪坐标"""
    
    print("\n" + "=" * 80)
    print("阶段1: Mouth区域检测和裁剪")
    print("=" * 80)
    
    if not MOUTH_MODEL_PATH.exists():
        print(f"错误: Mouth检测模型不存在: {MOUTH_MODEL_PATH}")
        return False
    
    # 加载模型
    print(f"加载Mouth检测模型: {MOUTH_MODEL_PATH}")
    model = YOLO(str(MOUTH_MODEL_PATH))
    
    stats = {'total': 0, 'success': 0, 'failed': 0, 'by_class': {}}
    crop_info = {}  # 存储裁剪坐标信息
    
    # 处理每个类别
    for class_name in ['乳牙滞留', '其他疾病', '正常']:
        class_dir = ORIGINAL_DIR / class_name
        if not class_dir.exists():
            continue
            
        print(f"\n处理类别: {class_name}")
        output_class_dir = CROPPED_DIR / class_name
        output_class_dir.mkdir(parents=True, exist_ok=True)
        
        # 获取所有图像文件
        image_files = []
        for ext in ['*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG']:
            image_files.extend(list(class_dir.glob(ext)))
        
        class_stats = {'total': len(image_files), 'success': 0, 'failed': 0}
        
        for img_file in tqdm(image_files, desc=f"裁剪 {class_name}"):
            stats['total'] += 1
            
            try:
                # 预测mouth区域
                results = model(str(img_file), conf=0.25, verbose=False)
                
                if len(results) == 0 or len(results[0].boxes) == 0:
                    stats['failed'] += 1
                    class_stats['failed'] += 1
                    continue
                
                # 获取最高置信度的检测框
                boxes = results[0].boxes
                best_idx = torch.argmax(boxes.conf).item()
                best_box = boxes.xyxy[best_idx].cpu().numpy()
                
                # 打开图像并裁剪
                image = Image.open(img_file).convert('RGB')
                orig_width, orig_height = image.size
                x1, y1, x2, y2 = map(int, best_box)
                
                # 添加边距
                margin_x = max(int((x2 - x1) * 0.1), 20)
                margin_y = max(int((y2 - y1) * 0.1), 20)
                
                x1_crop = max(0, x1 - margin_x)
                y1_crop = max(0, y1 - margin_y)
                x2_crop = min(image.width, x2 + margin_x)
                y2_crop = min(image.height, y2 + margin_y)
                
                if x2_crop > x1_crop and y2_crop > y1_crop:
                    cropped_image = image.crop((x1_crop, y1_crop, x2_crop, y2_crop))
                    output_path = output_class_dir / img_file.name
                    cropped_image.save(output_path, quality=95)
                    
                    # 保存裁剪坐标信息
                    crop_info[img_file.stem] = {
                        'original_size': [orig_width, orig_height],
                        'crop_box': [x1_crop, y1_crop, x2_crop, y2_crop],
                        'cropped_size': [x2_crop - x1_crop, y2_crop - y1_crop],
                        'class': class_name
                    }
                    
                    stats['success'] += 1
                    class_stats['success'] += 1
                else:
                    stats['failed'] += 1
                    class_stats['failed'] += 1
                    
            except Exception as e:
                print(f"  错误 {img_file.name}: {e}")
                stats['failed'] += 1
                class_stats['failed'] += 1
        
        stats['by_class'][class_name] = class_stats
        print(f"  {class_name}: 成功 {class_stats['success']}/{class_stats['total']}")
    
    print(f"\n阶段1完成!")
    print(f"总图像数: {stats['total']}")
    print(f"成功裁剪: {stats['success']}")
    print(f"失败数量: {stats['failed']}")
    print(f"成功率: {stats['success']/stats['total']*100:.2f}%")
    
    # 保存统计信息和裁剪坐标
    stats['crop_coordinates'] = crop_info
    with open(CROPPED_DIR / 'crop_statistics.json', 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    return stats['success'] > 0


# ==================== 阶段2: 准备Disease检测数据集 ====================
def stage2_prepare_detection_dataset():
    """阶段2: 准备disease_area检测数据集"""
    
    print("\n" + "=" * 80)
    print("阶段2.1: 准备Disease检测数据集")
    print("=" * 80)
    
    # 创建目录结构
    for split in ['train', 'val', 'test']:
        for subdir in ['images', 'labels']:
            (DETECTION_DATA_DIR / split / subdir).mkdir(parents=True, exist_ok=True)
    
    all_data = []
    
    # 处理乳牙滞留类（有disease_area标注）
    retention_dir = CROPPED_DIR / '乳牙滞留'
    if retention_dir.exists():
        for img_file in retention_dir.glob('*'):
            if img_file.suffix.lower() in ['.jpg', '.png', '.jpeg']:
                # 在原始数据集中查找JSON标注
                json_file = find_original_json(img_file.stem)
                if json_file:
                    all_data.append({
                        'image': img_file,
                        'json': json_file,
                        'label': 1  # 乳牙滞留
                    })
    
    # 处理非乳牙滞留类（空标注）
    for class_name in ['其他疾病', '正常']:
        class_dir = CROPPED_DIR / class_name
        if class_dir.exists():
            for img_file in class_dir.glob('*'):
                if img_file.suffix.lower() in ['.jpg', '.png', '.jpeg']:
                    all_data.append({
                        'image': img_file,
                        'json': None,
                        'label': 0  # 非乳牙滞留
                    })
    
    print(f"总样本数: {len(all_data)}")
    print(f"乳牙滞留样本: {sum(1 for d in all_data if d['label'] == 1)}")
    print(f"非乳牙滞留样本: {sum(1 for d in all_data if d['label'] == 0)}")
    
    # 打乱并划分数据集
    np.random.seed(42)
    np.random.shuffle(all_data)
    
    n_total = len(all_data)
    n_train = int(n_total * 0.7)
    n_val = int(n_total * 0.15)
    
    splits = {
        'train': all_data[:n_train],
        'val': all_data[n_train:n_train + n_val],
        'test': all_data[n_train + n_val:]
    }
    
    print(f"数据集划分: train={n_train}, val={n_val}, test={n_total - n_train - n_val}")
    
    # 创建YOLO格式的数据集
    for split_name, split_data in splits.items():
        print(f"\n处理 {split_name} 集...")
        
        for item in tqdm(split_data, desc=f"处理 {split_name}"):
            # 复制图像
            dst_image = DETECTION_DATA_DIR / split_name / 'images' / item['image'].name
            shutil.copy2(item['image'], dst_image)
            
            # 创建标注文件
            label_file = DETECTION_DATA_DIR / split_name / 'labels' / (item['image'].stem + '.txt')
            
            if item['label'] == 1 and item['json']:  # 乳牙滞留类且有标注
                annotations = parse_disease_annotations(item['json'], item['image'])
                if annotations:
                    with open(label_file, 'w') as f:
                        for ann in annotations:
                            f.write(f"0 {ann['x_center']:.6f} {ann['y_center']:.6f} {ann['width']:.6f} {ann['height']:.6f}\n")
                else:
                    label_file.touch()  # 即使是乳牙滞留，如果没有检测到标注也创建空文件
            else:  # 非乳牙滞留类，创建空标注文件
                label_file.touch()
    
    # 创建YAML配置文件
    yaml_content = f"""# Disease检测数据集配置
path: {DETECTION_DATA_DIR}
train: train/images
val: val/images
test: test/images

# 类别
names:
  0: disease_area  # 乳牙滞留区域
"""
    
    yaml_file = DETECTION_DATA_DIR / 'disease_detection.yaml'
    with open(yaml_file, 'w', encoding='utf-8') as f:
        f.write(yaml_content.strip())
    
    print(f"\nYAML配置文件已创建: {yaml_file}")
    return yaml_file


def find_original_json(image_stem):
    """在原始数据集中查找对应的JSON文件"""
    for ext in ['.json', '.JSON']:
        for class_name in ['乳牙滞留', '其他疾病', '正常']:
            json_file = ORIGINAL_DIR / class_name / (image_stem + ext)
            if json_file.exists():
                return json_file
    return None


def parse_disease_annotations(json_file, image_file):
    """
    解析JSON标注，只保留disease_area，并转换为YOLO格式
    关键：JSON中的坐标是基于原始图像的，需要转换到裁剪后的图像坐标系
    """
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 获取裁剪后图像的尺寸
        cropped_image = Image.open(image_file)
        cropped_width, cropped_height = cropped_image.size
        
        # 读取裁剪坐标信息
        crop_stats_file = CROPPED_DIR / 'crop_statistics.json'
        crop_box = None
        
        if crop_stats_file.exists():
            with open(crop_stats_file, 'r', encoding='utf-8') as f:
                crop_stats = json.load(f)
                crop_coords = crop_stats.get('crop_coordinates', {})
                crop_info = crop_coords.get(image_file.stem)
                
                if crop_info:
                    # crop_box格式: [x1, y1, x2, y2]
                    crop_box = crop_info['crop_box']
        
        annotations = []
        
        for shape in data.get('shapes', []):
            label = shape.get('label', '').lower()
            
            # 只保留disease_area标签
            if label not in DISEASE_LABELS:
                continue
            
            points = shape.get('points', [])
            shape_type = shape.get('shape_type', '')
            
            if shape_type == 'rectangle' and len(points) == 2:
                x1_orig, y1_orig = points[0]
                x2_orig, y2_orig = points[1]
            elif shape_type == 'polygon' and len(points) >= 3:
                x_coords = [p[0] for p in points]
                y_coords = [p[1] for p in points]
                x1_orig, y1_orig = min(x_coords), min(y_coords)
                x2_orig, y2_orig = max(x_coords), max(y_coords)
            else:
                continue
            
            # 如果有裁剪信息，转换坐标到裁剪后的图像坐标系
            if crop_box:
                crop_x1, crop_y1, crop_x2, crop_y2 = crop_box
                
                # 将原始图像坐标转换为裁剪图像坐标
                x1_crop = x1_orig - crop_x1
                y1_crop = y1_orig - crop_y1
                x2_crop = x2_orig - crop_x1
                y2_crop = y2_orig - crop_y1
                
                # 确保坐标在裁剪图像范围内
                x1_crop = max(0, min(x1_crop, cropped_width))
                x2_crop = max(0, min(x2_crop, cropped_width))
                y1_crop = max(0, min(y1_crop, cropped_height))
                y2_crop = max(0, min(y2_crop, cropped_height))
                
                # 检查标注是否在裁剪区域内
                if x2_crop <= 0 or y2_crop <= 0 or x1_crop >= cropped_width or y1_crop >= cropped_height:
                    # 标注框完全在裁剪区域外
                    continue
                
                # 检查边界框大小
                if abs(x2_crop - x1_crop) < 1 or abs(y2_crop - y1_crop) < 1:
                    continue
                
                # 转换为YOLO格式（归一化坐标）
                x_center = (x1_crop + x2_crop) / 2 / cropped_width
                y_center = (y1_crop + y2_crop) / 2 / cropped_height
                width = abs(x2_crop - x1_crop) / cropped_width
                height = abs(y2_crop - y1_crop) / cropped_height
                
            else:
                # 如果没有裁剪信息，假设图像没有被裁剪（直接使用原坐标）
                print(f"  警告: 没有找到裁剪信息 {image_file.stem}，使用原始坐标")
                x_center = (x1_orig + x2_orig) / 2 / cropped_width
                y_center = (y1_orig + y2_orig) / 2 / cropped_height
                width = abs(x2_orig - x1_orig) / cropped_width
                height = abs(y2_orig - y1_orig) / cropped_height
            
            # 确保坐标在0-1范围内
            x_center = max(0, min(1, x_center))
            y_center = max(0, min(1, y_center))
            width = max(0, min(1, width))
            height = max(0, min(1, height))
            
            # 只添加有效的标注
            if width > 0.01 and height > 0.01:  # 至少1%的图像大小
                annotations.append({
                    'x_center': x_center,
                    'y_center': y_center,
                    'width': width,
                    'height': height
                })
        
        return annotations
        
    except Exception as e:
        print(f"  解析标注失败 {json_file}: {e}")
        import traceback
        traceback.print_exc()
        return []


# ==================== 阶段2: 训练Disease检测模型 ====================
def stage2_train_detection_model(data_yaml):
    """阶段2.2: 训练Disease检测模型"""
    
    print("\n" + "=" * 80)
    print("阶段2.2: 训练YOLOv11-small Disease检测模型")
    print("=" * 80)
    
    device = '0' if torch.cuda.is_available() else 'cpu'
    print(f"使用设备: {device}")
    
    # 加载预训练模型
    print(f"加载预训练模型: {YOLO_PRETRAINED}")
    model = YOLO(str(YOLO_PRETRAINED))
    
    # 训练配置
    train_args = {
        'data': str(data_yaml),
        'epochs': 100,
        'batch': 16,
        'imgsz': IMAGE_SIZE,
        'device': device,
        'patience': 20,
        'save': True,
        'cache': True,
        'workers': 4,
        'optimizer': 'AdamW',
        'lr0': 0.001,
        'project': str(OUTPUT_DIR),
        'name': 'disease_detection_yolo11s',
        'exist_ok': True
    }
    
    print("开始训练...")
    results = model.train(**train_args)
    
    # 训练结果保存在 OUTPUT_DIR/disease_detection_yolo11s/weights/best.pt
    best_model_path = OUTPUT_DIR / 'disease_detection_yolo11s' / 'weights' / 'best.pt'
    print(f"训练完成，最佳模型: {best_model_path}")
    
    return best_model_path


# ==================== 阶段2: 评估Disease检测模型 ====================
def stage2_evaluate_detection_model(model_path, data_yaml):
    """阶段2.3: 评估Disease检测模型"""
    
    print("\n" + "=" * 80)
    print("阶段2.3: 评估Disease检测模型")
    print("=" * 80)
    
    model = YOLO(str(model_path))
    
    print("在测试集上评估...")
    metrics = model.val(data=str(data_yaml), split='test')
    
    results = {
        'mAP50': float(metrics.box.map50),
        'mAP50-95': float(metrics.box.map),
        'precision': float(metrics.box.p[0]) if len(metrics.box.p) > 0 else 0.0,
        'recall': float(metrics.box.r[0]) if len(metrics.box.r) > 0 else 0.0,
    }
    
    print("\n目标检测评估结果:")
    print(f"  mAP50: {results['mAP50']:.4f}")
    print(f"  mAP50-95: {results['mAP50-95']:.4f}")
    print(f"  Precision: {results['precision']:.4f}")
    print(f"  Recall: {results['recall']:.4f}")
    
    # 保存结果
    with open(OUTPUT_DIR / 'detection_evaluation.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    return results


# ==================== 阶段2: 图像分类（基于检测结果） ====================
def stage2_image_classification(model_path):
    """阶段2.4: 基于检测结果进行图像分类并5折交叉验证"""
    
    print("\n" + "=" * 80)
    print("阶段2.4: 图像分类 - 5折交叉验证")
    print("=" * 80)
    
    # 收集所有图像和标签
    all_images = []
    all_labels = []
    
    for class_name in ['乳牙滞留', '其他疾病', '正常']:
        class_dir = CROPPED_DIR / class_name
        if class_dir.exists():
            for img_file in class_dir.glob('*'):
                if img_file.suffix.lower() in ['.jpg', '.png', '.jpeg']:
                    all_images.append(img_file)
                    all_labels.append(1 if class_name == '乳牙滞留' else 0)
    
    print(f"总样本数: {len(all_images)}")
    print(f"乳牙滞留: {sum(all_labels)}, 非乳牙滞留: {len(all_labels) - sum(all_labels)}")
    
    # 加载模型
    model = YOLO(str(model_path))
    
    # 准备数据
    data = list(zip(all_images, all_labels))
    np.random.seed(42)
    np.random.shuffle(data)
    
    # 5折交叉验证
    kfold = KFold(n_splits=N_FOLDS, shuffle=False)
    
    fold_results = []
    all_predictions = []
    all_true_labels = []
    
    for fold, (train_idx, val_idx) in enumerate(kfold.split(data)):
        print(f"\n{'='*60}")
        print(f"Fold {fold + 1}/{N_FOLDS}")
        print(f"{'='*60}")
        
        val_data = [data[i] for i in val_idx]
        val_paths = [item[0] for item in val_data]
        val_labels = [item[1] for item in val_data]
        
        print(f"验证集: {len(val_paths)} 张图片")
        print(f"类别分布: 非乳牙滞留={sum(1 for l in val_labels if l==0)}, 乳牙滞留={sum(1 for l in val_labels if l==1)}")
        
        # 预测验证集
        pred_labels = []
        for img_path in tqdm(val_paths, desc="预测"):
            try:
                results = model(str(img_path), conf=0.25, verbose=False)
                # 如果检测到disease_area，则分类为乳牙滞留
                has_disease = len(results) > 0 and len(results[0].boxes) > 0
                pred_labels.append(1 if has_disease else 0)
            except:
                pred_labels.append(0)
        
        # 计算准确率
        correct = sum(1 for pred, true in zip(pred_labels, val_labels) if pred == true)
        accuracy = correct / len(val_labels)
        
        print(f"验证集准确率: {accuracy:.4f} ({correct}/{len(val_labels)})")
        
        # 计算混淆矩阵和分类报告
        cm = confusion_matrix(val_labels, pred_labels)
        report = classification_report(val_labels, pred_labels,
                                      target_names=['非乳牙滞留', '乳牙滞留'],
                                      output_dict=True, zero_division=0)
        
        fold_results.append({
            'fold': fold + 1,
            'accuracy': accuracy,
            'confusion_matrix': cm.tolist(),
            'classification_report': report
        })
        
        all_predictions.extend(pred_labels)
        all_true_labels.extend(val_labels)
    
    # 汇总结果
    overall_accuracy = accuracy_score(all_true_labels, all_predictions)
    overall_cm = confusion_matrix(all_true_labels, all_predictions)
    overall_report = classification_report(all_true_labels, all_predictions,
                                         target_names=['非乳牙滞留', '乳牙滞留'],
                                         output_dict=True, zero_division=0)
    
    summary = {
        'overall_accuracy': overall_accuracy,
        'overall_confusion_matrix': overall_cm.tolist(),
        'overall_classification_report': overall_report,
        'mean_accuracy': np.mean([r['accuracy'] for r in fold_results]),
        'std_accuracy': np.std([r['accuracy'] for r in fold_results]),
        'fold_results': fold_results
    }
    
    print("\n" + "=" * 80)
    print("5折交叉验证汇总结果")
    print("=" * 80)
    print(f"平均准确率: {summary['mean_accuracy']:.4f} ± {summary['std_accuracy']:.4f}")
    print(f"总体准确率: {summary['overall_accuracy']:.4f}")
    print("\n总体混淆矩阵:")
    print(overall_cm)
    print("\n总体分类报告:")
    print(classification_report(all_true_labels, all_predictions,
                               target_names=['非乳牙滞留', '乳牙滞留'], zero_division=0))
    
    # 保存结果
    with open(OUTPUT_DIR / 'classification_5fold_results.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # 添加其他疾病分类分析
    analyze_other_disease_classification(all_predictions, all_true_labels, all_images)

    return summary


def analyze_other_disease_classification(all_predictions, all_true_labels, all_images):
    """
    分析其他疾病文件夹中图像的分类结果分布

    Args:
        all_predictions: 所有预测标签列表
        all_true_labels: 所有真实标签列表
        all_images: 所有图像路径列表
    """
    print("\n" + "=" * 80)
    print("其他疾病图像分类结果分析")
    print("=" * 80)

    # 找出所有来自其他疾病文件夹的图像及其预测结果
    other_disease_results = []

    for i, (img_path, pred_label, true_label) in enumerate(zip(all_images, all_predictions, all_true_labels)):
        # 检查图像是否来自其他疾病文件夹
        if '其他疾病' in str(img_path):
            other_disease_results.append({
                'index': i,
                'image_path': str(img_path),
                'image_name': img_path.name,
                'predicted_label': pred_label,  # 0: 非乳牙滞留, 1: 乳牙滞留
                'true_label': true_label,
                'predicted_class': '非乳牙滞留' if pred_label == 0 else '乳牙滞留'
            })

    if not other_disease_results:
        print("未找到其他疾病文件夹中的图像")
        return

    print(f"其他疾病文件夹图像总数: {len(other_disease_results)}")

    # 统计分类结果
    normal_count = sum(1 for r in other_disease_results if r['predicted_label'] == 0)
    retention_count = sum(1 for r in other_disease_results if r['predicted_label'] == 1)

    print(f"\n分类结果统计:")
    print(f"  被分类为非乳牙滞留: {normal_count} 张 ({normal_count/len(other_disease_results)*100:.1f}%)")
    print(f"  被分类为乳牙滞留: {retention_count} 张 ({retention_count/len(other_disease_results)*100:.1f}%)")


    print(f"\n前10张被分类为非乳牙滞留的图像:")
    normal_images = [r for r in other_disease_results if r['predicted_label'] == 0][:10]
    for img in normal_images:
        print(f"  - {img['image_name']}")

    print(f"\n前10张被分类为乳牙滞留的图像:")
    retention_images = [r for r in other_disease_results if r['predicted_label'] == 1][:10]
    for img in retention_images:
        print(f"  - {img['image_name']}")

    # 保存详细结果
    analysis_results = {
        'total_other_disease_images': len(other_disease_results),
        'classified_as_normal': normal_count,
        'classified_as_retention': retention_count,
        'normal_percentage': normal_count/len(other_disease_results)*100,
        'retention_percentage': retention_count/len(other_disease_results)*100,
        'detailed_results': other_disease_results
    }

    with open(OUTPUT_DIR / 'other_disease_classification_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(analysis_results, f, indent=2, ensure_ascii=False)

    print(f"\n详细分析结果已保存到: {OUTPUT_DIR / 'other_disease_classification_analysis.json'}")


# ==================== 主函数 ====================
def main():
    """主函数"""
    
    print("\n" + "=" * 80)
    print("完整的两阶段乳牙滞留识别流程")
    print("=" * 80)
    
    # ========== 阶段1: Mouth检测和裁剪 ==========
    if not (CROPPED_DIR / 'crop_statistics.json').exists():
        if not stage1_crop_mouths():
            print("阶段1失败，程序终止")
            return
    else:
        print("\n检测到已裁剪的数据集，跳过阶段1")
    
    # ========== 阶段2: Disease检测 + 分类 ==========
    # 2.1 准备数据集
    if not (DETECTION_DATA_DIR / 'disease_detection.yaml').exists():
        data_yaml = stage2_prepare_detection_dataset()
    else:
        data_yaml = DETECTION_DATA_DIR / 'disease_detection.yaml'
        print("\n检测到已准备的检测数据集，跳过数据准备步骤")
    
    # 2.2 训练模型
    best_model_path = OUTPUT_DIR / 'disease_detection_yolo11s' / 'weights' / 'best.pt'
    if not best_model_path.exists():
        best_model_path = stage2_train_detection_model(data_yaml)
    else:
        print(f"\n检测到已训练的模型: {best_model_path}")
    
    # 2.3 评估检测模型
    detection_results = stage2_evaluate_detection_model(best_model_path, data_yaml)
    
    # 2.4 图像分类 + 5折交叉验证
    classification_results = stage2_image_classification(best_model_path)
    
    # ========== 最终总结 ==========
    print("\n" + "=" * 80)
    print("完整流程完成!")
    print("=" * 80)
    print("\n【阶段2 - 目标检测结果】")
    print(f"  mAP50: {detection_results['mAP50']:.4f}")
    print(f"  mAP50-95: {detection_results['mAP50-95']:.4f}")
    print(f"  Precision: {detection_results['precision']:.4f}")
    print(f"  Recall: {detection_results['recall']:.4f}")
    print("\n【阶段2 - 图像分类结果】")
    print(f"  5折平均准确率: {classification_results['mean_accuracy']:.4f} ± {classification_results['std_accuracy']:.4f}")
    print(f"  总体准确率: {classification_results['overall_accuracy']:.4f}")
    print(f"  非乳牙滞留 Precision: {classification_results['overall_classification_report']['非乳牙滞留']['precision']:.4f}")
    print(f"  非乳牙滞留 Recall: {classification_results['overall_classification_report']['非乳牙滞留']['recall']:.4f}")
    print(f"  乳牙滞留 Precision: {classification_results['overall_classification_report']['乳牙滞留']['precision']:.4f}")
    print(f"  乳牙滞留 Recall: {classification_results['overall_classification_report']['乳牙滞留']['recall']:.4f}")
    print(f"\n所有结果已保存到: {OUTPUT_DIR}")
    print(f"  - 检测评估: detection_evaluation.json")
    print(f"  - 分类结果: classification_5fold_results.json")


if __name__ == '__main__':
    main()

