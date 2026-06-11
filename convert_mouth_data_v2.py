#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据转换脚本 - 将新的乳牙滞留数据集转换为YOLO格式用于mouth检测训练
"""

import os
import json
import shutil
from pathlib import Path
from tqdm import tqdm
import random

def convert_to_yolo_format(points, image_width, image_height):
    """将矩形坐标转换为YOLO格式"""
    x1, y1 = points[0]
    x2, y2 = points[1]
    
    # 计算中心点和宽高
    center_x = (x1 + x2) / 2 / image_width
    center_y = (y1 + y2) / 2 / image_height
    width = abs(x2 - x1) / image_width
    height = abs(y2 - y1) / image_height
    
    return center_x, center_y, width, height

def process_json_file(json_path, output_dir, images_dir, labels_dir):
    """处理单个JSON文件"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 获取图像信息
        image_path = data.get('imagePath', '')
        image_width = data.get('imageWidth', 0)
        image_height = data.get('imageHeight', 0)
        
        if not image_path or not image_width or not image_height:
            return False
        
        # 查找对应的图像文件
        json_dir = os.path.dirname(json_path)
        full_image_path = os.path.join(json_dir, image_path)
        
        if not os.path.exists(full_image_path):
            print(f"图像文件不存在: {full_image_path}")
            return False
        
        # 查找mouth标注
        mouth_annotations = []
        for shape in data.get('shapes', []):
            if shape.get('label', '').lower() == 'mouth' and shape.get('shape_type') == 'rectangle':
                points = shape.get('points', [])
                if len(points) == 2:
                    x, y, w, h = convert_to_yolo_format(points, image_width, image_height)
                    mouth_annotations.append(f"0 {x:.6f} {y:.6f} {w:.6f} {h:.6f}")
        
        if not mouth_annotations:
            return False
        
        # 生成新的文件名
        base_name = Path(json_path).stem
        new_image_name = f"{base_name}.jpg"
        new_label_name = f"{base_name}.txt"
        
        # 复制图像文件
        target_image_path = os.path.join(images_dir, new_image_name)
        shutil.copy2(full_image_path, target_image_path)
        
        # 创建标注文件
        target_label_path = os.path.join(labels_dir, new_label_name)
        with open(target_label_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(mouth_annotations))
        
        return True
        
    except Exception as e:
        print(f"处理文件 {json_path} 时出错: {e}")
        return False

def split_dataset(images_dir, labels_dir, output_dir, train_ratio=0.7, val_ratio=0.2, test_ratio=0.1):
    """将数据集分割为训练、验证和测试集"""
    
    # 获取所有图像文件
    image_files = [f for f in os.listdir(images_dir) if f.endswith(('.jpg', '.png', '.jpeg'))]
    
    # 随机打乱
    random.shuffle(image_files)
    
    total_count = len(image_files)
    train_count = int(total_count * train_ratio)
    val_count = int(total_count * val_ratio)
    
    # 分割数据
    train_files = image_files[:train_count]
    val_files = image_files[train_count:train_count + val_count]
    test_files = image_files[train_count + val_count:]
    
    # 创建目录结构
    for split in ['train', 'val', 'test']:
        os.makedirs(os.path.join(output_dir, split, 'images'), exist_ok=True)
        os.makedirs(os.path.join(output_dir, split, 'labels'), exist_ok=True)
    
    # 移动文件
    def move_files(file_list, split_name):
        for filename in file_list:
            # 移动图像
            src_img = os.path.join(images_dir, filename)
            dst_img = os.path.join(output_dir, split_name, 'images', filename)
            shutil.move(src_img, dst_img)
            
            # 移动标注
            label_filename = filename.rsplit('.', 1)[0] + '.txt'
            src_label = os.path.join(labels_dir, label_filename)
            dst_label = os.path.join(output_dir, split_name, 'labels', label_filename)
            if os.path.exists(src_label):
                shutil.move(src_label, dst_label)
    
    move_files(train_files, 'train')
    move_files(val_files, 'val')
    move_files(test_files, 'test')
    
    print(f"数据集分割完成:")
    print(f"训练集: {len(train_files)} 张")
    print(f"验证集: {len(val_files)} 张")
    print(f"测试集: {len(test_files)} 张")

def main():
    # 数据集路径
    source_dir = Path("/home/xiaobei/hbx/乳牙滞留识别/乳牙滞留识别918_清洗后")
    output_dir = Path("/home/xiaobei/hbx/乳牙滞留识别/yolo_mouth_dataset_v2")
    
    # 创建输出目录
    temp_images_dir = output_dir / "temp_images"
    temp_labels_dir = output_dir / "temp_labels"
    
    temp_images_dir.mkdir(parents=True, exist_ok=True)
    temp_labels_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"开始处理数据集: {source_dir}")
    print(f"输出目录: {output_dir}")
    
    # 统计信息
    total_files = 0
    processed_files = 0
    
    # 遍历所有子目录
    for folder in source_dir.iterdir():
        if folder.is_dir():
            print(f"处理文件夹: {folder.name}")
            
            # 查找所有JSON文件
            json_files = list(folder.glob("*.json"))
            total_files += len(json_files)
            
            for json_file in tqdm(json_files, desc=f"处理 {folder.name}"):
                if process_json_file(str(json_file), str(output_dir), 
                                   str(temp_images_dir), str(temp_labels_dir)):
                    processed_files += 1
    
    print(f"\n数据处理完成!")
    print(f"总文件数: {total_files}")
    print(f"成功处理: {processed_files}")
    print(f"成功率: {processed_files/total_files*100:.2f}%")
    
    if processed_files > 0:
        print("\n开始分割数据集...")
        split_dataset(str(temp_images_dir), str(temp_labels_dir), str(output_dir))
        
        # 删除临时目录
        shutil.rmtree(temp_images_dir)
        shutil.rmtree(temp_labels_dir)
        
        # 创建YAML配置文件
        yaml_content = f"""path: {output_dir}
train: train
val: val
test: test

names:
  0: mouth
"""
        
        yaml_path = output_dir / "mouth_detection_v2.yaml"
        with open(yaml_path, 'w', encoding='utf-8') as f:
            f.write(yaml_content)
        
        print(f"配置文件已创建: {yaml_path}")
        print("数据集准备完成！")

if __name__ == "__main__":
    random.seed(42)  # 设置随机种子以确保可重复性
    main()
