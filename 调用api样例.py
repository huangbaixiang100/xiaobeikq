import requests

# 设置文件路径和API地址
test_image = r"C:\Users\柏\Desktop\小北口腔—乳牙滞留识别任务\乳牙滞留识别101\乳牙滞留\0 (4).jpg"
API_BASE_URL = "http://60.28.106.46:15025"

# 打开图像文件
with open(test_image, 'rb') as f:
    files = {'file': f}  # 将文件作为 multipart/form-data 上传
    params = {'save_image_flag': 'true'}  # 设置 save_image_flag 为 true，表示保存原始图片

    # 发送POST请求到API
    response = requests.post(f'{API_BASE_URL}/api/v1/analyze', files=files, params=params)

    # 解析响应
    result = response.json()

    # 打印结果
    if response.status_code == 200 and result.get('success'):
        print(f"分类结果: {result['classification']}")
        print(f"预测概率: {result['probability']:.2%}")
        print(f"清晰度: {result['sharpness']:.2f}")
        print(f"曝光度: {result['exposure']:.2f}")
        print(f"图片已保存: {result['image_saved']}")
        if result['image_saved']:
            print(f"保存路径: {result['saved_image_path']}")
    else:
        print(f"API 请求失败: {result.get('message', '无详细错误信息')}")
