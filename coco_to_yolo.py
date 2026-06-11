import json
import os
import shutil
from pathlib import Path
from tqdm import tqdm
import cv2
import numpy as np

def get_image_size(image_path):
    """获取图片尺寸"""
    try:
        img = cv2.imread(image_path)
        if img is not None:
            h, w = img.shape[:2]
            return w, h
        return None, None
    except Exception as e:
        print(f"读取图片失败 {image_path}: {e}")
        return None, None

def convert_coco_to_yolo(json_path, output_dir, class_mapping):
    """将单个COCO格式JSON转换为YOLO格式"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 获取图片信息
        image_path = json_path.with_suffix('.jpg')
        if not image_path.exists():
            image_path = json_path.with_suffix('.png')

        if not image_path.exists():
            print(f"图片文件不存在: {image_path}")
            return False

        img_width, img_height = get_image_size(str(image_path))
        if img_width is None or img_height is None:
            print(f"无法获取图片尺寸: {image_path}")
            return False

        # 复制图片到输出目录
        output_image_path = output_dir / image_path.name
        shutil.copy2(image_path, output_image_path)

        # 创建对应的txt标注文件
        txt_filename = image_path.stem + '.txt'
        txt_path = output_dir / txt_filename

        yolo_annotations = []

        shapes = data.get('shapes', [])
        for shape in shapes:
            label = shape.get('label', '')
            points = shape.get('points', [])
            shape_type = shape.get('shape_type', '')

            if label not in class_mapping:
                continue

            class_id = class_mapping[label]

            if shape_type == 'rectangle' and len(points) == 2:
                # 矩形标注
                x1, y1 = points[0]
                x2, y2 = points[1]

                # 计算YOLO格式坐标
                x_center = (x1 + x2) / 2 / img_width
                y_center = (y1 + y2) / 2 / img_height
                width = (x2 - x1) / img_width
                height = (y2 - y1) / img_height

                yolo_annotations.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

            elif shape_type == 'polygon' and len(points) >= 3:
                # 多边形标注 - 转换为外接矩形
                points_array = np.array(points)
                x_coords = points_array[:, 0]
                y_coords = points_array[:, 1]

                x_min, x_max = np.min(x_coords), np.max(x_coords)
                y_min, y_max = np.min(y_coords), np.max(y_coords)

                # 计算YOLO格式坐标
                x_center = (x_min + x_max) / 2 / img_width
                y_center = (y_min + y_max) / 2 / img_height
                width = (x_max - x_min) / img_width
                height = (y_max - y_min) / img_height

                yolo_annotations.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")

        # 写入YOLO格式标注文件
        if yolo_annotations:
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(yolo_annotations))

        return True

    except Exception as e:
        print(f"转换文件失败 {json_path}: {e}")
        return False

def create_class_mapping():
    """创建类别映射"""
    return {
        'mouth': 0,
        'disease_area': 1,
        'other_disease_area': 2
    }

def convert_dataset(input_dir, output_dir, phase_name):
    """转换整个数据集"""
    print(f"开始转换 {phase_name} 数据集...")

    # 创建输出目录
    output_dir.mkdir(parents=True, exist_ok=True)

    # 创建类别映射
    class_mapping = create_class_mapping()

    # 创建类别标签文件
    classes_file = output_dir / 'classes.txt'
    with open(classes_file, 'w', encoding='utf-8') as f:
        for class_name, class_id in sorted(class_mapping.items(), key=lambda x: x[1]):
            f.write(f"{class_name}\n")

    # 获取所有JSON文件
    json_files = list(input_dir.glob("*.json"))
    print(f"找到 {len(json_files)} 个JSON文件")

    success_count = 0
    for json_file in tqdm(json_files, desc=f"转换 {phase_name}"):
        if convert_coco_to_yolo(json_file, output_dir, class_mapping):
            success_count += 1

    print(f"{phase_name} 数据集转换完成: {success_count}/{len(json_files)} 个文件成功转换")
    return success_count

def split_dataset(yolo_dir, train_ratio=0.7, val_ratio=0.2, test_ratio=0.1):
    """将数据集分割为训练集、验证集和测试集"""
    print("开始数据集分割...")

    # 获取所有图片文件
    image_files = list(yolo_dir.glob("*.jpg")) + list(yolo_dir.glob("*.png"))
    total_files = len(image_files)

    if total_files == 0:
        print("没有找到图片文件")
        return

    # 随机打乱
    np.random.shuffle(image_files)

    # 计算分割点
    train_end = int(total_files * train_ratio)
    val_end = train_end + int(total_files * val_ratio)

    train_files = image_files[:train_end]
    val_files = image_files[train_end:val_end]
    test_files = image_files[val_end:]

    # 创建子目录
    train_dir = yolo_dir / 'train'
    val_dir = yolo_dir / 'val'
    test_dir = yolo_dir / 'test'

    train_dir.mkdir(exist_ok=True)
    val_dir.mkdir(exist_ok=True)
    test_dir.mkdir(exist_ok=True)

    def move_files(file_list, target_dir):
        for img_file in file_list:
            # 移动图片文件
            shutil.move(str(img_file), str(target_dir / img_file.name))
            # 移动对应的标注文件
            txt_file = img_file.with_suffix('.txt')
            if txt_file.exists():
                shutil.move(str(txt_file), str(target_dir / txt_file.name))

    # 移动文件到相应目录
    move_files(train_files, train_dir)
    move_files(val_files, val_dir)
    move_files(test_files, test_dir)

    # 复制类别文件到各个子目录
    classes_file = yolo_dir / 'classes.txt'
    if classes_file.exists():
        shutil.copy2(classes_file, train_dir / 'classes.txt')
        shutil.copy2(classes_file, val_dir / 'classes.txt')
        shutil.copy2(classes_file, test_dir / 'classes.txt')

    print("数据集分割完成:")
    print(f"- 训练集: {len(train_files)} 个样本 ({train_ratio*100:.1f}%)")
    print(f"- 验证集: {len(val_files)} 个样本 ({val_ratio*100:.1f}%)")
    print(f"- 测试集: {len(test_files)} 个样本 ({test_ratio*100:.1f}%)")

def main():
    # 输入和输出路径
    input_base = Path("/home/xiaobei/hbx/乳牙滞留识别/乳牙滞留识别918_stage1")
    output_base = Path("/home/xiaobei/hbx/乳牙滞留识别/yolo_dataset")

    # 第一阶段：转换mouth检测数据集
    print("=" * 60)
    print("第一阶段：准备mouth检测数据集")
    print("=" * 60)

    mouth_output = output_base / "mouth_detection"
    mouth_output.mkdir(parents=True, exist_ok=True)

    # 合并乳牙滞留和其他疾病的数据（只保留mouth标注）
    print("转换mouth检测数据集...")
    success_count = 0

    for category in ["乳牙滞留", "其他疾病"]:
        input_dir = input_base / category
        if input_dir.exists():
            json_files = list(input_dir.glob("*.json"))
            for json_file in tqdm(json_files, desc=f"处理 {category}"):
                # 只转换包含mouth标注的文件
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    has_mouth = any(shape.get('label') == 'mouth' for shape in data.get('shapes', []))
                    if has_mouth:
                        class_mapping = {'mouth': 0}  # mouth检测只用一个类别
                        if convert_coco_to_yolo(json_file, mouth_output, class_mapping):
                            success_count += 1
                except Exception as e:
                    print(f"处理文件失败 {json_file}: {e}")

    print(f"mouth检测数据集准备完成: {success_count} 个样本")

    # 第二阶段：转换disease_area检测数据集
    print("\n" + "=" * 60)
    print("第二阶段：准备disease_area检测数据集")
    print("=" * 60)

    disease_output = output_base / "disease_detection"
    disease_output.mkdir(parents=True, exist_ok=True)

    class_mapping = create_class_mapping()
    success_count = 0

    for category in ["乳牙滞留", "其他疾病"]:
        input_dir = input_base / category
        if input_dir.exists():
            json_files = list(input_dir.glob("*.json"))
            for json_file in tqdm(json_files, desc=f"处理 {category}"):
                if convert_coco_to_yolo(json_file, disease_output, class_mapping):
                    success_count += 1

    print(f"disease_area检测数据集准备完成: {success_count} 个样本")

    # 分割数据集
    print("\n" + "=" * 60)
    print("分割数据集")
    print("=" * 60)

    split_dataset(mouth_output, train_ratio=0.7, val_ratio=0.2, test_ratio=0.1)
    split_dataset(disease_output, train_ratio=0.7, val_ratio=0.2, test_ratio=0.1)

    print("\n" + "=" * 60)
    print("数据格式转换完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
