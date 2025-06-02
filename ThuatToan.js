
// Ẩn hiện ô nhập K khi chọn KNN
document.getElementById('algorithm').addEventListener('change', () => {
  document.getElementById('kValue').style.display =
    document.getElementById('algorithm').value === 'knn' ? 'block' : 'none';
});

// Hàm đọc file Excel trả về mảng 2 chiều (header + rows)
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size > 100 * 1024 * 1024) {
      reject("File không hợp lệ hoặc quá 100MB!");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      resolve(jsonData);
    };
    reader.readAsArrayBuffer(file);
  });
}

// Tạo bảng HTML từ headers và rows
function generateTableHTML(headers, rows) {
  let html = '<table class="result-table"><thead><tr>';
  headers.forEach(h => html += `<th>${h}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => html += `<td>${cell}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// Hàm chạy thuật toán
async function runAlgorithm() {
  const trainFile = document.getElementById('fileInput').files[0];
  const testFile = document.getElementById('testFileInput').files[0];
  const algorithm = document.getElementById('algorithm').value;
  const k = parseInt(document.getElementById('kValue').value);
  const labelType = document.getElementById('labelType').value;  // <-- Lấy giá trị loại nhãn

  if (!trainFile) {
    alert("Vui lòng chọn file dữ liệu huấn luyện.");
    return;
  }
  if (!testFile) {
    alert("Vui lòng chọn file dữ liệu cần dự đoán.");
    return;
  }
  if (algorithm === 'knn' && (isNaN(k) || k <= 0)) {
    alert("Vui lòng nhập giá trị k hợp lệ (số nguyên dương).");
    return;
  }

  try {
    const trainData = await readExcelFile(trainFile);
    const testData = await readExcelFile(testFile);

    const trainHeaders = trainData[0];
    const trainRows = trainData.slice(1);

    const testHeaders = testData[0];
    const testRows = testData.slice(1);

    // Chuyển dữ liệu huấn luyện sang số (ngoại trừ nhãn cuối)
    const features = trainRows.map(row => row.slice(0, -1).map(Number));
    const labels = trainRows.map(row => row[row.length - 1]);

    // Chuyển dữ liệu test sang số
    const testFeatures = testRows.map(row => row.map(Number));

    // Hiển thị bảng dữ liệu huấn luyện
    let output = `<div class="section-title">1. Dữ liệu huấn luyện (${trainRows.length} dòng)</div>`;
    output += generateTableHTML(trainHeaders, trainRows);

    // Hiển thị bảng dữ liệu dự đoán
    output += `<div class="section-title mt-4">2. Dữ liệu dự đoán (${testRows.length} dòng)</div>`;
    output += generateTableHTML(testHeaders, testRows);

    if (algorithm === 'knn') {
      // Lấy giá trị K từ form (input/select có id="kValue")
      const kInput = document.getElementById('kValue');
      let k = Number(kInput.value);
      if (isNaN(k) || k < 1) {
        k = 3; // Giá trị mặc định nếu người dùng không nhập hợp lệ
      }
    
      // Lấy loại khoảng cách từ dropdown id="distance"
      const distanceType = document.getElementById('distance').value;
    
      // Dự đoán nhãn cho tất cả dòng test
      const predictions = testFeatures.map(tf => {
        const dists = features.map((x, i) => {
          let dist;
          if (distanceType === 'Euclidean') {
            dist = Math.sqrt(x.reduce((acc, xi, j) => acc + (xi - tf[j]) ** 2, 0));
          } else if (distanceType === 'Manhattan') {
            dist = x.reduce((acc, xi, j) => acc + Math.abs(xi - tf[j]), 0);
          } else {
            dist = 0; // Trường hợp không hợp lệ, mặc định 0 (có thể tùy chỉnh)
          }
          return { label: labels[i], dist };
        });
    
        dists.sort((a, b) => a.dist - b.dist);
        const topK = dists.slice(0, k);
    
        if (labelType === 'classification') {
          // Phân lớp: vote số đông
          const vote = {};
          topK.forEach(d => vote[d.label] = (vote[d.label] || 0) + 1);
          return Object.entries(vote).sort((a, b) => b[1] - a[1])[0][0];
        } else if (labelType === 'regression') {
          // Hồi quy tuyến tính: trung bình nhãn (label phải là số)
          const sum = topK.reduce((acc, d) => acc + Number(d.label), 0);
          return (sum / topK.length).toFixed(4);
        }
      });
    
      // Bảng kết quả dự đoán cho tất cả dòng test
      output += `<div class="section-title mt-4">3. Kết quả dự đoán cho toàn bộ dữ liệu test</div>`;
      output += `<table class="result-table"><thead><tr><th>STT</th><th>Dự đoán nhãn</th></tr></thead><tbody>`;
      predictions.forEach((p, i) => {
        output += `<tr><td>${i + 1}</td><td>${p}</td></tr>`;
      });
      output += `</tbody></table>`;
    
      // Nếu là phân lớp thì giải thích chi tiết KNN cho từng dòng test
      for (let i = 0; i < testFeatures.length; i++) {
        output += `<div class="section-title mt-4">4. Giải thích chi tiết KNN cho dòng test thứ ${i + 1}</div>`;
        output += explainKNN(features, labels, testFeatures[i], k, labelType);
      }
    }
      
    else if (algorithm === 'bayes') {
      // Dự đoán nhãn cho tất cả dòng test
      const predictions = testFeatures.map(testX => {
        const nSamples = features.length;
        const nFeatures = features[0].length;
        const uniqueLabels = [...new Set(labels)];
    
        // Tính xác suất tiên nghiệm P(label)
        const prior = {};
        uniqueLabels.forEach(label => {
          prior[label] = labels.filter(l => l === label).length / nSamples;
        });
    
        // Tính mean và variance theo nhãn
        const stats = {};
        uniqueLabels.forEach(label => {
          const rows = features.filter((_, i) => labels[i] === label);
          const count = rows.length;
          const mean = [];
          const variance = [];
    
          for (let j = 0; j < nFeatures; j++) {
            const colVals = rows.map(r => r[j]);
            const m = colVals.reduce((a, b) => a + b, 0) / count;
            mean.push(m);
            const v = colVals.reduce((a, b) => a + (b - m) ** 2, 0) / (count - 1 || 1);
            variance.push(v);
          }
          stats[label] = { mean, variance, count };
        });
    
        function gaussianPDF(x, mean, variance) {
          const denom = Math.sqrt(2 * Math.PI * variance);
          const num = Math.exp(-((x - mean) ** 2) / (2 * variance));
          return num / denom;
        }
    
        // Tính posterior cho từng nhãn
        const posteriorProbs = {};
        uniqueLabels.forEach(label => {
          let likelihood = 1;
          if (labelType === 'classification') {
            for (let j = 0; j < nFeatures; j++) {
              const p = gaussianPDF(testX[j], stats[label].mean[j], stats[label].variance[j] || 1e-6);
              likelihood *= p;
            }
          } else if (labelType === 'regression') {
            likelihood = gaussianPDF(testX[0], stats[label].mean[0], stats[label].variance[0] || 1e-6);
          }
          posteriorProbs[label] = likelihood * prior[label];
        });
    
        return Object.entries(posteriorProbs).sort((a, b) => b[1] - a[1])[0][0];
      });
    
      output += `<div class="section-title mt-4">3. Kết quả dự đoán Bayes cho toàn bộ dữ liệu test</div>`;
      output += `<table class="result-table"><thead><tr><th>STT</th><th>Dự đoán nhãn</th></tr></thead><tbody>`;
      predictions.forEach((p, i) => {
        output += `<tr><td>${i + 1}</td><td>${p}</td></tr>`;
      });
      output += `</tbody></table>`;
    
      // Giải thích chi tiết Bayes cho từng dòng test
      for (let i = 0; i < testFeatures.length; i++) {
        output += `<div class="section-title mt-4">4. Giải thích chi tiết Bayes cho dòng test thứ ${i + 1}</div>`;
        output += explainBayes(features, labels, testFeatures[i], labelType, i);
      }
      // Gán ra DOM
      document.getElementById("resultBox").innerHTML = output;

      // Gọi MathJax để render công thức
      if (window.MathJax) {
        MathJax.typesetPromise();
      }
    }
    
    else if (algorithm === 'tree') {
      output += `<div class="section-title">3. Kết quả dự đoán bằng Cây Quyết định</div>`;
      output += `<table class="result-table"><thead><tr><th>STT</th><th>Dự đoán nhãn</th></tr></thead><tbody>`;
      testFeatures.forEach((testX, i) => {
        const predictionHTML = explainDecisionTree(features, labels, testX);
        const predicted = predictionHTML.match(/Kết quả dự đoán:<\/b>\s*(\S+)</)[1];
        output += `<tr><td>${i + 1}</td><td>${predicted}</td></tr>`;
      });
      output += `</tbody></table>`;
    
      testFeatures.forEach((testX, i) => {
        output += `<div class="section-title mt-4">4. Giải thích chi tiết cho dòng test thứ ${i + 1}</div>`;
        output += explainDecisionTree(features, labels, testX);
      });
    }

    else if (algorithm === 'linear') {
      output += `<div class="section-title">3. Một số lưu ý cho giải thuật Hồi quy tuyến tính</div>`;
      output += `<div style="border: 2px solid #f39c12; background-color: #fff8e1; padding: 12px; border-radius: 8px; margin-top: 10px;">
        <p style="font-weight: bold; color: #d35400; font-size: 18px; margin-bottom: 8px;">Lưu ý:</p>
        <p>- Underfitting: Mô hình quá đơn giản không bắt được quan hệ phức tạp trong dữ liệu.</p>
        <p>- Overfitting: Dữ liệu huấn luyện quá khớp, kém khái quát trên dữ liệu mới.</p>
        <p>- Đa cộng tuyến: Gây ra trọng số biến động lớn, khó diễn giải.</p>
      </div>`;
    
      testFeatures.forEach((testX, i) => {
        output += `<div class="section-title mt-4">4. Giải thích chi tiết cho dòng test thứ ${i + 1}</div>`;
        output += explainLinearRegression(features, labels, testX);
      });
    }

    else if (algorithm === 'logistic') {
      output += `<div class="section-title">3. Một số lưu ý cho giải thuật Hồi quy Logistic (với tốc độ học là 0.1 và lặp 05 lần)</div>`;
      output += `<div style="border: 2px solid #f39c12; background-color: #fff8e1; padding: 12px; border-radius: 8px; margin-top: 10px;">
        <p style="font-weight: bold; color: #d35400; font-size: 18px; margin-bottom: 8px;">Lưu ý:</p>
        <p>- Trong thực tế giải thuật phải lặp cho đến khi giá trị các tham số hội tụ (ổn định) mới dừng</p>
        <p>- Tốc độ học có thể thay đổi phù hợp với từng bài, để đơn giản chúng ta lấy mặc định là 0.1</p>
        <p>- Trong lời giải phía dưới chỉ lặp tượng trưng 05 lần và kết thúc</p>
      </div>`;

      // output += `<table class="result-table"><thead><tr><th>STT</th><th>\\( \\hat{y} \\)</th><th>Phân lớp</th></tr></thead><tbody>`;
    
      testFeatures.forEach((testX, i) => {
        const explanationHTML = explainLogisticRegression(features, labels, testX);
        
        // Trích giá trị \\hat{y} = ... và phân lớp từ HTML bằng Regex
        const probMatch = explanationHTML.match(/\\hat{y} = [^\=]+ = ([\d\.eE\-+]+)/);
        const classMatch = explanationHTML.match(/<b>Phân lớp:<\/b> (\d+)/);
    
        const predictedProb = probMatch ? parseFloat(probMatch[1]).toFixed(4) : 'N/A';
        const predictedClass = classMatch ? classMatch[1] : 'N/A';
    
        output += `<tr><td>${i + 1}</td><td>${predictedProb}</td><td>${predictedClass}</td></tr>`;
    
        // Hiển thị giải thích chi tiết cho từng test sample
        output += `<div class="section-title mt-4">4. Giải thích chi tiết Logistic Regression cho dòng test thứ ${i + 1}</div>`;
        output += explanationHTML;
      });
    
      output += `</tbody></table>`;
    }    
    
    
    else {
      output += '<div class="text-danger">Lỗi tùy chọn, vui lòng load lại</div>';
    }

    document.getElementById('resultBox').innerHTML = output;
  } catch (error) {
    alert(error);
  }
}


//Thuật toán KNN
function explainKNN(X, y, testX, k, labelType) {
  // Lấy giá trị khoảng cách từ form
  let distanceType = "Euclidean"; // mặc định
  const distSelected = document.getElementById("distance")?.value;
  if (distSelected === "Manhattan") {
    distanceType = "Manhattan";
  } else if (distSelected === "Euclidean") {
    distanceType = "Euclidean";
  }

  // Tính khoảng cách dựa theo loại khoảng cách
  const distances = X.map((x, i) => {
    let dist = 0;
    if (distanceType === "Manhattan") {
      // Công thức Manhattan: sum |xi - yi|
      dist = x.reduce((acc, xi, j) => acc + Math.abs(xi - testX[j]), 0);
    } else {
      // Mặc định Euclidean: sqrt(sum (xi - yi)^2)
      dist = Math.sqrt(x.reduce((acc, xi, j) => acc + (xi - testX[j]) ** 2, 0));
    }
    return { index: i, row: x, label: y[i], dist };
  });

  // Sắp xếp theo khoảng cách và chọn k láng giềng gần nhất
  const sortedByDist = distances.sort((a, b) => a.dist - b.dist).slice(0, k);
  const topKIndices = new Set(sortedByDist.map(d => d.index));

  // Tạo HTML công thức theo khoảng cách chọn
  let formulaHTML = "";
  if (distanceType === "Manhattan") {
    formulaHTML += `
    <div class="formula">
      <p>Công thức tính khoảng cách Euclidean</p>
      <img src="./Img/Dinh_Nghia_Tap_Du_lieu.png" alt="Định nghĩa tập dữ liệu" style="max-width: 100%; height: auto;">
      <img src="./Img/Euclidean.png" alt="Công thức Euclidean" style="max-width: 100%; height: auto;">
    </div>
    `;
  } else {
    formulaHTML = `
    <div class="formula">
      <p>Công thức tính khoảng cách Euclidean</p>
      <img src="./Img/Dinh_Nghia_Tap_Du_lieu.png" alt="Định nghĩa tập dữ liệu" style="max-width: 100%; height: auto;">
      <img src="./Img/Manhattan.png" alt="Công thức Manhattan" style="max-width: 100%; height: auto;">
    </div>
    `;
  }

  // Tạo HTML kết quả
  let output = `
    <div class="knn-container">
      <h3>Thuật toán KNN (k=${k}) - Khoảng cách: ${distanceType}</h3>
      <div class="formula">
        <b>Công thức tính khoảng cách:</b> ${formulaHTML}
      </div>

      <h3>Bảng dữ liệu + Khoảng cách</h3>
      <div style="color: #d9534f; font-weight: bold; font-size: 16px; background-color: #fff3cd; padding: 10px; border-radius: 5px; border: 1px solid #f0ad4e; margin: 10px 0;">
        Click chuột vào kết quả tính khoảng cách trong bảng kết quả để xem các bước tính chi tiết
      </div>

      <table class="knn-table">
        <thead>
          <tr>
            <th>STT</th>
            ${testX.map((_, i) => `<th>X${i + 1}</th>`).join('')}
            <th>Nhãn</th>
            <th>Khoảng cách</th>
          </tr>
        </thead>
        <tbody>
          ${distances.map((d, i) => `
            <tr class="${topKIndices.has(i) ? "highlight" : ""}">
              <td>${i + 1}</td>
              ${d.row.map(x => `<td>${x.toFixed(4)}</td>`).join("")}
              <td>${d.label}</td>
              <td class="distance-cell" onclick="window.showDistanceCalculation(event, ${i}, ${JSON.stringify(testX)}, ${JSON.stringify(d.row)}, '${distanceType}')">
                ${d.dist.toFixed(4)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div id="distance-modal" class="modal" style="display:none">
      <div class="modal-content">
        <span class="close" onclick="document.getElementById('distance-modal').style.display='none'">&times;</span>
        <div id="distance-modal-body"></div>
      </div>
    </div>

    <style>
      .knn-container { font-family: Arial, sans-serif; margin: 20px; }
      .knn-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      .knn-table th, .knn-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
      .knn-table th { background-color: #f2f2f2; }
      .highlight { background-color: #e6f7ff; }
      .formula { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
      
      .distance-cell {
        cursor: pointer;
        color: blue;
        text-decoration: underline;
      }
      .distance-cell:hover {
        background-color: #f0f0f0;
      }
      
      .modal {
        position: fixed; z-index: 1; left: 0; top: 0; 
        width: 100%; height: 100%; background: rgba(0,0,0,0.4);
      }
      .modal-content {
        background: white; margin: 10% auto; padding: 20px; 
        width: 70%; max-width: 600px; border-radius: 5px;
      }
      .close { float: right; font-size: 24px; cursor: pointer; }
    </style>
  `;

  // Dự đoán kết quả
  if (labelType === "classification") {
    const vote = {};
    sortedByDist.forEach(d => vote[d.label] = (vote[d.label] || 0) + 1);
    const prediction = Object.entries(vote).sort((a, b) => b[1] - a[1])[0][0];

    output += `
      <div class="formula">
        <p>Công thức xác định nhãn cho dữ liệu có nhãn Rời rạc trong KNN</p>
        <img src="./Img/PhanLoaiKNN_RoiRac.png" alt="Công thức xác định nhãn cho dữ liệu rời rạc" style="max-width: 100%; height: auto;">
      </div>
      <div class="prediction">
        <h4>Kết quả dự đoán</h4>
        <p>Bỏ phiếu của ${k} láng giềng gần nhất:</p>
        <ul>
          ${Object.entries(vote).map(([label, count]) => `<li>${label}: ${count} phiếu</li>`).join("")}
        </ul>
        <p><b>Dự đoán nhãn:</b> ${prediction}</p>
      </div>
    `;
  } else if (labelType === "regression") {
    const avg = (sortedByDist.reduce((acc, d) => acc + Number(d.label), 0) / k).toFixed(4);

    output += `
      <div class="formula">
        <p>Công thức xác định nhãn cho dữ liệu có nhãn Liên tục trong KNN</p>
        <img src="./Img/PhanLoaiKNN_LienTuc.png" alt="Công thức xác định nhãn cho dữ liệu liên tục" style="max-width: 100%; height: auto;">
      </div>
      <div class="prediction">
        <h4>Kết quả dự đoán</h4>
        <p><b>Giá trị trung bình:</b> ${avg}</p>
      </div>
    `;
  }

  return output;
}

// Thuật toán Bayes
function explainBayes(X, y, testX, labelType, indexTest = 0) {
  let output = `<div class="section-title">Thuật toán Bayes</div>`;

  const nSamples = X.length;
  const nFeatures = X[0].length;
  const labels = [...new Set(y)];

  const prior = {};
  labels.forEach(label => {
    prior[label] = y.filter(l => l === label).length / nSamples;
  });

  output += `
    <div class="formula">
      <p>Công thức xác suất Bayes cho nhãn rời rạc (Discrete):</p>
      <p>
        \\[
          P(C_k | \\mathbf{x}) = \\frac{P(C_k) \\prod_{i=1}^n P(x_i | C_k)}{P(\\mathbf{x})}
        \\]
      </p>
      <p>Áp dụng <b>Laplace smoothing</b> để tránh xác suất bằng 0:</p>
      <p>
        \\[
          P(x_i | C_k) = \\frac{N_{x_i, C_k} + 1}{N_{C_k} + V}
        \\]
      </p>
      <p>với \\(N_{x_i, C_k}\\) là số lần xuất hiện giá trị \\(x_i\\) trong lớp \\(C_k\\), \\(N_{C_k}\\) tổng số mẫu lớp \\(C_k\\), \\(V\\) số lượng giá trị rời rạc có thể của thuộc tính \\(x_i\\).</p>
    </div>
  `;

    output += `
    <div class="formula">
      <p>Công thức phân phối chuẩn cho nhãn liên tục (Gaussian):</p>
      <p>
        \\[
          f(x_i | \\mu_k, \\sigma_k^2) = \\frac{1}{\\sqrt{2\\pi \\sigma_k^2}} 
          \\exp\\left(-\\frac{(x_i - \\mu_k)^2}{2\\sigma_k^2}\\right)
        \\]
      </p>
    </div>`
    output += `
    <div class="formula">
      <p>Thêm epsilon nhỏ (\\(\\epsilon\\)) vào phương sai để tránh chia cho 0:</p>
      <p>
        \\[
          \\sigma_k^2 := \\sigma_k^2 + \\epsilon, \\quad \\epsilon = 10^{-6}
        \\]
      </p>
    </div>
  `;

  // Thống kê cho Gaussian (liên tục)
  let stats = {};
  if (labelType === 'regression') {
    const epsilon = 1e-6;
    labels.forEach(label => {
      const rows = X.filter((_, i) => y[i] === label);
      const count = rows.length;
      const mean = [];
      const variance = [];

      for (let j = 0; j < nFeatures; j++) {
        const colVals = rows.map(r => r[j]);
        const m = colVals.reduce((a, b) => a + b, 0) / count;
        mean.push(m);
        const v = colVals.reduce((a, b) => a + (b - m) ** 2, 0) / (count - 1 || 1);
        variance.push(v + epsilon); // Thêm epsilon vào variance ở đây
      }
      stats[label] = { mean, variance, count };
    });

    output += `<div class="section-title">Thống kê đặc trưng theo nhãn (Gaussian)</div>`;
    for (const label of labels) {
      output += `<div><b>Nhóm nhãn: ${label}</b><br>Mean = [${stats[label].mean.map(m => m.toFixed(4)).join(", ")}]<br>Variance = [${stats[label].variance.map(v => v.toFixed(6)).join(", ")}]</div>`;
    }
  }

  // Hàm Gaussian PDF
  function gaussianPDF(x, mean, variance) {
    const epsilon = 1e-6;
    if (variance === 0) variance = epsilon; // tránh chia 0
    else variance += epsilon; // thêm epsilon vào variance
    const denom = Math.sqrt(2 * Math.PI * variance);
    const num = Math.exp(-((x - mean) ** 2) / (2 * variance));
    return num / denom;
  }

  // Hàm tính xác suất rời rạc có Laplace smoothing
  function laplaceProbability(featureIndex, value, label, X, y) {
    const rows = X.filter((_, i) => y[i] === label);
    const countLabel = rows.length;
    // Lấy tập giá trị rời rạc duy nhất của thuộc tính đó
    const uniqueValues = [...new Set(X.map(row => row[featureIndex]))];
    const V = uniqueValues.length;

    // Đếm số lần value xuất hiện trong lớp label
    const countValueInLabel = rows.filter(r => r[featureIndex] === value).length;

    // Công thức Laplace smoothing:
    // P(x_i | C_k) = (N_{x_i, C_k} + 1) / (N_{C_k} + V)
    return (countValueInLabel + 1) / (countLabel + V);
  }

  output += `<div class="section-title">Tính xác suất dự đoán cho dữ liệu test</div>`;
  output += `<div><b>Dữ liệu test:</b> [${testX.map(n => n.toFixed ? n.toFixed(4) : n).join(", ")}]</div>`;

  let posteriorProbs = {};

  for (const label of labels) {
    let likelihood = 1;
    if (labelType === 'classification') {
      // Thêm phần giải thích công thức Bayes
      output += `
        <div class="section-title">Giải hệ phương trình Bayes từng bước</div>
        <div class="formula">
          <p><b>Bước 1: Tính xác suất tiên nghiệm P(C<sub>k</sub>)</b></p>
          <p>\\[
            P(C_k) = \\frac{\\text{Số mẫu thuộc lớp } C_k}{\\text{Tổng số mẫu}}
          \\]</p>
          
          <p><b>Bước 2: Tính xác suất likelihood P(x<sub>i</sub>|C<sub>k</sub>) với Laplace Smoothing</b></p>
          <p>\\[
            P(x_i | C_k) = \\frac{N_{x_i, C_k} + 1}{N_{C_k} + V}
          \\]</p>
          <p>Trong đó:
            <ul>
              <li>$N_{x_i, C_k}$: Số lần giá trị $x_i$ xuất hiện trong lớp $C_k$</li>
              <li>$N_{C_k}$: Tổng số mẫu thuộc lớp $C_k$</li>
              <li>$V$: Số giá trị rời rạc khác nhau của thuộc tính $x_i$</li>
            </ul>
          </p>
          
          <p><b>Bước 3: Tính xác suất hậu nghiệm tỉ lệ</b></p>
          <p>\\[
            P(C_k | \\mathbf{x}) = P(C_k) \\times \\prod_{i=1}^n P(x_i | C_k)
          \\]</p>
        </div>
      `;
    
      // Tính toán và hiển thị từng bước
      for (const label of labels) {
        let likelihood = 1;
        const priorProb = prior[label];
        
        output += `<div class="section-title"><b>Xác suất cho nhãn ${label}</b></div>`;
        output += `<div><b>Bước 1: Tính P(C = ${label})</b></div>`;
        output += `<div>\\[
          P(${label}) = \\frac{${y.filter(l => l === label).length}}{${nSamples}} = ${priorProb.toFixed(4)}
        \\]</div>`;
        
        output += `<div><b>Bước 2: Tính các xác suất likelihood</b></div>`;
        for (let j = 0; j < nFeatures; j++) {
          const x = testX[j];
          const rowsWithLabel = X.filter((_, i) => y[i] === label);
          const countLabel = rowsWithLabel.length;
          const uniqueValues = [...new Set(X.map(row => row[j]))];
          const V = uniqueValues.length;
          const countValueInLabel = rowsWithLabel.filter(r => r[j] === x).length;
          
          const p = (countValueInLabel + 1) / (countLabel + V);
          likelihood *= p;
          
          output += `
            <div style="margin:10px 0;">
              <b>Thuộc tính X<sub>${j+1}</sub> = ${x.toFixed(4)}</b><br>
              \\[
                P(x_{${j+1}} = ${x.toFixed(4)} | C = ${label}) = 
                \\frac{${countValueInLabel} + 1}{${countLabel} + ${V}} = ${p.toFixed(4)}
              \\]
              <div style="margin-left:20px; color:#555;">
                • Số lần xuất hiện ${x.toFixed(4)} trong lớp ${label}: ${countValueInLabel}<br>
                • Tổng mẫu lớp ${label}: ${countLabel}<br>
                • Số giá trị khác nhau của X<sub>${j+1}</sub>: ${V}
              </div>
            </div>
          `;
        }
        
        output += `<div><b>Bước 3: Tính xác suất hậu nghiệm tỉ lệ</b></div>`;
        output += `<div>\\[
          P(${label} | \\mathbf{x}) = ${priorProb.toFixed(4)} \\times ${likelihood.toExponential(4)} = ${(priorProb * likelihood).toExponential(4)}
        \\]</div>`;
        
        posteriorProbs[label] = priorProb * likelihood;
        output += `<hr style="margin:15px 0; border-top:1px dashed #ccc;">`;
      }
      // Bổ sung phần giải hệ phương trình chuẩn hóa xác suất hậu nghiệm
      output += `
      <div class="section-title"><b>Bước 4: Giải hệ phương trình xác suất hậu nghiệm</b></div>
    
      <p><b>Giải thích công thức:</b></p>
      <p>Dựa vào định lý Bayes:</p>
      <p>\\[
        P(C_k \\mid \\mathbf{x}) = \\frac{P(C_k) \\cdot P(\\mathbf{x} \\mid C_k)}{P(\\mathbf{x})}
      \\]</p>
      <p>Vì \\(P(\\mathbf{x})\\) là hằng số đối với mọi nhãn nên ta đặt:</p>
      <p>\\[
        \\alpha_k = P(C_k) \\cdot \\prod_i P(x_i \\mid C_k)
      \\quad \\text{và} \\quad
        P(C_k \\mid \\mathbf{x}) = \\frac{\\alpha_k}{\\sum_j \\alpha_j}
      \\]</p>
    
      <p><b>Tính từng \\(\\alpha_k\\) cụ thể:</b></p>
      <ul>
        ${
          Object.entries(posteriorProbs).map(([label, alpha], index) => {
            const priorProb = prior[label];
            let likelihoodParts = [];
            let likelihood = 1;
    
            for (let j = 0; j < nFeatures; j++) {
              const x = testX[j];
              const rowsWithLabel = X.filter((_, i) => y[i] === label);
              const countLabel = rowsWithLabel.length;
              const uniqueValues = [...new Set(X.map(row => row[j]))];
              const V = uniqueValues.length;
              const countValueInLabel = rowsWithLabel.filter(r => r[j] === x).length;
    
              const pxGivenC = (countValueInLabel + 1) / (countLabel + V);
              likelihood *= pxGivenC;
    
              likelihoodParts.push(`
                P(x_${j + 1} = ${x.toFixed(4)} \\mid C = ${label}) = 
                \\frac{${countValueInLabel} + 1}{${countLabel} + ${V}} = ${pxGivenC.toFixed(4)}
              `);
            }
    
            return `
              <li>
                <b>Cho nhãn \\( C = ${label} \\):</b><br>
                - Xác suất tiên nghiệm: \\( P(C = ${label}) = ${priorProb.toFixed(4)} \\)<br>
                - Tích xác suất có điều kiện:<br>
                <div style="margin-left:20px;">
                  ${likelihoodParts.map(line => `\\[ ${line} \\]`).join('')}
                </div>
                - Tích lại tất cả: \\[
                  \\prod_i P(x_i \\mid C = ${label}) = ${likelihood.toExponential(6)}
                \\]<br>
                - Tính \\( \\alpha_${index + 1} \\): \\[
                  \\alpha_${index + 1} = ${priorProb.toFixed(4)} \\times ${likelihood.toExponential(6)} = ${alpha.toExponential(6)}
                \\]
              </li>
            `;
          }).join('')
        }
      </ul>
    
      <p><b>Tính tổng các \\(\\alpha_j\\):</b></p>
      <p>\\[
        \\sum_j \\alpha_j = ${Object.values(posteriorProbs).reduce((a, b) => a + b, 0).toExponential(6)}
      \\]</p>
    
      <p><b>Chuẩn hóa để tính xác suất hậu nghiệm thực sự:</b></p>
      <ul>
        ${
          (() => {
            const sum = Object.values(posteriorProbs).reduce((a, b) => a + b, 0);
            return Object.entries(posteriorProbs).map(([label, alpha], index) => {
              const prob = alpha / sum;
              return `
                <div style="color:#c53030;">\\[
                  P(C = ${label} \\mid \\mathbf{x}) = 
                  \\frac{\\alpha_${index + 1}}{\\sum_j \\alpha_j} = 
                  \\frac{${alpha.toExponential(6)}}{${sum.toExponential(6)}} = ${prob.toFixed(4)} = ${(prob * 100).toFixed(2)}\\%
                \\]</div>
              `;
            }).join('');
          })()
        }
      </ul>
    `;    
      // Thêm phần kết luận
      const predictedLabel = Object.entries(posteriorProbs).sort((a, b) => b[1] - a[1])[0][0];
      output += `<div class="section-title"><b>Kết luận</b></div>`;
      output += `<div>Nhãn có xác suất hậu nghiệm tỉ lệ cao nhất là <b>${predictedLabel}</b></div>`;
      output += `<div style="margin-top:10px;">`;
      
      // Object.entries(posteriorProbs).forEach(([label, prob]) => {
      //   output += `<div>P(C = ${label} | x) tỉ lệ: ${prob.toExponential(4)}</div>`;
      // });
      
      output += `</div>`;
    }
    else if (labelType === 'regression') {
      output += `<div><b>Nhãn liên tục: ${label}</b></div>`;
    
      // Bước 1: Công thức tổng quát tính trung bình và phương sai
      output += `
        <div style="margin-top:10px; font-family: monospace;">
          <b>Bước 1: Tính trung bình \\(\\mu\\) và phương sai \\(\\sigma^2\\)</b><br/>
          Với mỗi đặc trưng \\(x_j\\), tính trung bình và phương sai của các mẫu huấn luyện trong nhãn \\(C = ${label}\\):<br/>
          \\[
            \\mu_j = \\frac{1}{n} \\sum_{i=1}^n x_{i,j},\\quad
            \\sigma_j^2 = \\frac{1}{n} \\sum_{i=1}^n (x_{i,j} - \\mu_j)^2
          \\]
        </div>
      `;
    
      let likelihood = 1;
      const EPSILON = 1e-10; // Hằng số nhỏ để tránh likelihood = 0
    
      for (let j = 0; j < nFeatures; j++) {
        const x = testX[j];
        const mean = stats[label].mean[j];
        // Nếu phương sai = 0 thì thay bằng giá trị rất nhỏ để tránh chia cho 0
        const variance = stats[label].variance[j] > 0 ? stats[label].variance[j] : 1e-6;
        const stdDev = Math.sqrt(variance);
        const diff = x - mean;
        const exponent = -Math.pow(diff, 2) / (2 * variance);
        const denominator = Math.sqrt(2 * Math.PI * variance);
        const p = Math.exp(exponent) / denominator;
    
        // Đảm bảo p không bằng 0, nếu bằng 0 thì thay bằng EPSILON
        const safeP = p > 0 ? p : EPSILON;
    
        likelihood *= safeP;
    
        output += `
          <div style="margin:15px 0; font-family: monospace; padding: 10px; border: 1px solid #ccc; border-radius: 10px;">
            <b>-  Đặc trưng thứ ${j + 1}:</b><br/>
            Giá trị đầu vào: \\( x = ${x.toFixed(4)} \\)<br/>
            Trung bình đã tính: \\( \\mu = ${mean.toFixed(4)} \\)<br/>
            Phương sai đã tính: \\( \\sigma^2 = ${variance.toFixed(6)} \\)<br/><br/>
    
            <b>Bước 2: Tính xác suất có điều kiện bằng phân phối chuẩn (Gaussian)</b><br/>
            Công thức:<br/>
            \\[
              P(x_j | C) = 
              \\frac{1}{\\sqrt{2\\pi \\sigma_j^2}} 
              \\exp\\left( -\\frac{(x_j - \\mu_j)^2}{2\\sigma_j^2} \\right)
            \\]<br/>
    
            <b>Thế số:</b><br/>
            \\[
              P(x_{${j + 1}} | C = ${label}) = 
              \\frac{1}{\\sqrt{2\\pi \\cdot ${variance.toFixed(6)}}} 
              \\cdot \\exp\\left( -\\frac{(${x.toFixed(4)} - ${mean.toFixed(4)})^2}{2 \\cdot ${variance.toFixed(6)}} \\right)
            \\]
            \\[
              = \\frac{1}{${denominator.toFixed(6)}} 
              \\cdot \\exp\\left( ${exponent.toFixed(6)} \\right) 
              = ${safeP.toExponential(6)}
            \\]
          </div>
        `;
      }
    
      output += `
        <div style="margin-top:15px; font-family: monospace;">
          <b>Bước 3: Tính tổng xác suất có điều kiện (Likelihood)</b><br/>
          Vì các đặc trưng độc lập, nên:<br/>
          \\[
            P(\\vec{x}|C = ${label}) = \\prod_{j=1}^{${nFeatures}} P(x_j|C) 
            = ${likelihood.toExponential(6)}
          \\]
        </div>
      `;
    
      // Bước 4: Tính xác suất hậu nghiệm (Posterior)
      const priorProb = prior[label];
      const posterior = likelihood * priorProb;
      posteriorProbs[label] = posterior;
    
      output += `
        <div style="margin-top:10px; font-family: monospace;">
          <b>Bước 4: Tính xác suất hậu nghiệm (Posterior)</b><br/>
          Xác suất tiên nghiệm của nhãn là:<br/>
          \\[
            P(C = ${label}) = ${priorProb.toFixed(6)}
          \\]
          Suy ra:<br/>
          \\[
            P(C = ${label} | \\vec{x}) = P(\\vec{x} | C) \\cdot P(C) 
            = ${likelihood.toExponential(6)} \\cdot ${priorProb.toFixed(6)} 
            = ${posterior.toExponential(6)}
          \\]
        </div>
      `;
    }
  }
  // Bước 5: Chuẩn hóa xác suất hậu nghiệm (Posterior) cho tất cả nhãn
    
      // Tính tổng tất cả likelihood * prior (giá trị chưa chuẩn hóa)
      const sumPosterior = Object.values(posteriorProbs).reduce((a, b) => a + b, 0);
    
      output += `
        <div style="margin-top:10px; font-family: monospace;">
          <b>Bước 5: Tính xác suất hậu nghiệm (Posterior)</b><br/>
          <p><b>Mục đích:</b> Chuẩn hóa các xác suất hậu nghiệm sao cho tổng bằng 1, vì xác suất tổng trên tất cả các nhãn phải bằng 1.</p>
    
          <p><b>Bước 5.1: Tính tổng xác suất hậu nghiệm chưa chuẩn hóa (tổng tất cả likelihood nhân prior):</b></p>
          \\[
            S = \\sum_{k} P(\\vec{x} | C = k) \\cdot P(C = k) = 
      `;
    
      const terms = [];
      for (const lbl in posteriorProbs) {
        terms.push(`P(C=${lbl}) = ${posteriorProbs[lbl].toExponential(6)}`);
      }
      output += terms.join(' + ');
      output += ` = ${sumPosterior.toExponential(6)} \\]
          <p><b>Ý nghĩa:</b> Tổng này là mẫu số dùng để chuẩn hóa các xác suất hậu nghiệm.</p>`;
    
      output += `
          <p><b>Bước 5.2: Công thức chuẩn hóa xác suất hậu nghiệm từng nhãn:</b></p>
          \\[
            P(C = l | \\vec{x})_{chuẩn hóa} = \\frac{P(\\vec{x} | C = l) \\cdot P(C = l)}{S}
          \\]
          <p><b>Ý nghĩa:</b> Ta chia xác suất chưa chuẩn hóa của từng nhãn cho tổng để đảm bảo tổng các xác suất bằng 1.</p>
      `;
    
      output += `<p><b>Bước 5.3: Thế số cụ thể từng nhãn:</b></p>`;
      for (const lbl in posteriorProbs) {
        const unnormalized = posteriorProbs[lbl];
        const normalized = unnormalized / sumPosterior;
    
        output += `
          \\[
            P(C = ${lbl} | \\vec{x})_{chuẩn hóa} = \\frac{${unnormalized.toExponential(6)}}{${sumPosterior.toExponential(6)}} = ${(normalized).toExponential(6)*100}\\%
          \\]
        `;

      }
    
      // Chuẩn hóa posterior cho từng nhãn
      for (const lbl in posteriorProbs) {
        posteriorProbs[lbl] = posteriorProbs[lbl] / sumPosterior;
      }
    
      output += `
        <div style="margin-top: 30px;">
          <b>Bảng tóm tắt xác suất hậu nghiệm (Posterior) chuẩn hóa cho các nhãn:</b>
          <table 
            border="1" 
            cellpadding="8" 
            cellspacing="0" 
            style="
              border-collapse: collapse; 
              margin-top: 10px; 
              font-family: 'Calibri', Tahoma, Geneva, Verdana, sans-serif; 
              font-size: 14px; 
              text-align: center; 
              width: 50%;
              box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
            "
          >
            <thead>
              <tr style="background-color: #d9ead3; color: #274e13; font-weight: bold;">
                <th style="border: 1px solid #b6d7a8;">Nhãn (Label)</th>
                <th style="border: 1px solid #b6d7a8;">Xác suất hậu nghiệm (Posterior)</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const lbl in posteriorProbs) {
        output += `
          <tr style="background-color: #f9fff7;">
            <td style="border: 1px solid #b6d7a8; padding: 6px 12px;">${lbl}</td>
            <td style="border: 1px solid #b6d7a8; padding: 6px 12px;">${posteriorProbs[lbl].toFixed(6)*100}%</td>
          </tr>
        `;
      }

      output += `
            </tbody>
          </table>
        </div>
      `;

  const predictedLabel = Object.entries(posteriorProbs).sort((a, b) => b[1] - a[1])[0][0];
  output += `
    <div class="section-title" style="color: #d93025; font-weight: bold; font-size: 1.1em; margin-top: 15px;">
      <b>Kết luận:</b> Nhãn dự đoán là <b>${predictedLabel}</b> với xác suất tỉ lệ thuận cao nhất.
    </div>
  `;


  // Giữ nguyên phần vẽ Gaussian nếu là nhãn liên tục
  if (labelType === 'regression') {
    output += `<div class="section-title">Đồ thị phân phối Gaussian của các nhãn (tất cả các thuộc tính)</div>`;

    labels.forEach((label, labelIdx) => {
      output += `<div style="display: flex; gap: 15px; align-items: center; margin-bottom: 30px;">`;
      output += `<div style="font-weight: bold; min-width: 120px;">Nhóm nhãn: ${label}</div>`;
      for (let featIdx = 0; featIdx < nFeatures; featIdx++) {
        const canvasId = `gaussChart_${indexTest}_${labelIdx}_${featIdx}`;
        output += `
          <div style="text-align: center;">
            <div>Thuộc tính ${featIdx + 1}</div>
            <canvas id="${canvasId}" width="300" height="150" style="display: inline-block;"></canvas>
          </div>
        `;
      }
      output += `</div>`;
    });

    setTimeout(() => {
      if (typeof Chart !== 'undefined') {
        labels.forEach((label, labelIdx) => {
          for (let featIdx = 0; featIdx < nFeatures; featIdx++) {
            const mean = stats[label].mean[featIdx];
            const variance = stats[label].variance[featIdx];
            const ctx = document.getElementById(`gaussChart_${indexTest}_${labelIdx}_${featIdx}`);
            if (!ctx) return;

            // Tạo dữ liệu đồ thị Gaussian
            const data = [];
            const startX = mean - 4 * Math.sqrt(variance);
            const endX = mean + 4 * Math.sqrt(variance);
            const step = (endX - startX) / 100;
            for (let x = startX; x <= endX; x += step) {
              const y = gaussianPDF(x, mean, variance);
              data.push({ x, y });
            }

            new Chart(ctx, {
              type: 'line',
              data: {
                datasets: [{
                  label: `Gaussian PDF`,
                  data: data,
                  fill: false,
                  borderColor: 'blue',
                  tension: 0.3,
                  parsing: {
                    xAxisKey: 'x',
                    yAxisKey: 'y'
                  }
                }]
              },
              options: {
                scales: {
                  x: { type: 'linear', title: { display: true, text: 'x' } },
                  y: { title: { display: true, text: 'Probability Density' } }
                }
              }
            });
          }
        });
      }
    }, 100);
  }
  setTimeout(() => window.MathJax?.typeset(), 0);
  return output;
}

//Thuật toán Cây quyết định
function explainDecisionTree(X, y, testX) {
  let output = `<div class="section-title">Thuật toán Cây Quyết định (Decision Tree)</div>`;
  output += `
    <div class="formula">
    <p>Công thức Entropy (Độ hỗn loạn của tập dữ liệu)</p>
    <img src="./Img/Emtropy_DT.png" alt="Công thức Entropy" style="max-width: 100%; height: auto;"></div>
    <div class="formula">
    <p>Chỉ số Gini (Gini Impurity)</p>
    <img src="./Img/Gini_DT.png" alt="Gini Impurity" style="max-width: 100%; height: auto;"></div>
    <p>Phương sai giảm (Reduction in Variance) - cho hồi quy</p>
    <img src="./Img/PhuongSaiGiam_HoiQuy_DT.png" alt="Reduction in Variance" style="max-width: 100%; height: auto;"></div>
  `;

  function entropy(labels) {
    const counts = {};
    labels.forEach(label => counts[label] = (counts[label] || 0) + 1);
    const total = labels.length;
    let ent = 0;

    output += `<div>Tính Entropy cho tập dữ liệu: [${labels.join(", ")}]</div>`;
    Object.entries(counts).forEach(([label, count]) => {
      const p = count / total;
      const term = -p * Math.log2(p);
      ent += term;
      output += `<div> - Lớp '${label}': ${count}/${total} = ${p.toFixed(4)} → -${p.toFixed(4)} × log₂(${p.toFixed(4)}) = ${term.toFixed(4)}</div>`;
    });
    output += `<div><b>⇒ Entropy = ${ent.toFixed(4)}</b></div><br>`;
    return ent;
  }

  function split(X, y, featureIndex, threshold) {
    const leftX = [], leftY = [], rightX = [], rightY = [];
    X.forEach((row, i) => {
      if (row[featureIndex] <= threshold) {
        leftX.push(row);
        leftY.push(y[i]);
      } else {
        rightX.push(row);
        rightY.push(y[i]);
      }
    });
    return { leftX, leftY, rightX, rightY };
  }

  function bestSplit(X, y) {
    const nFeatures = X[0].length;
    const baseEntropy = entropy(y);
    let bestGain = -Infinity, bestFeature = -1, bestThreshold = null;

    for (let j = 0; j < nFeatures; j++) {
      const values = [...new Set(X.map(row => row[j]))].sort((a, b) => a - b);
      for (let i = 0; i < values.length - 1; i++) {
        const threshold = (values[i] + values[i + 1]) / 2;
        const { leftY, rightY } = split(X, y, j, threshold);
        if (leftY.length === 0 || rightY.length === 0) continue;

        const entLeft = entropy(leftY);
        const entRight = entropy(rightY);
        const pLeft = leftY.length / y.length;
        const pRight = rightY.length / y.length;
        const weightedEntropy = pLeft * entLeft + pRight * entRight;
        const gain = baseEntropy - weightedEntropy;

        output += `<div>- Thử tách tại đặc trưng x[${j}] ≤ ${threshold.toFixed(3)}:</div>`;
        output += `<div><i class="bi bi-arrow-right"></i> Gain = ${baseEntropy.toFixed(4)} - (${pLeft.toFixed(2)}×${entLeft.toFixed(4)} + ${pRight.toFixed(2)}×${entRight.toFixed(4)}) = <b>${gain.toFixed(4)}</b></div><br>`;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = j;
          bestThreshold = threshold;
        }
      }
    }

    return { bestFeature, bestThreshold };
  }

  function buildTree(X, y, depth = 0) {
    const unique = [...new Set(y)];
    if (unique.length === 1 || depth > 5) {
      output += `<div>- Node lá: tất cả mẫu đều là '${unique[0]}'</div><br>`;
      return { type: 'leaf', label: unique[0] };
    }

    const { bestFeature, bestThreshold } = bestSplit(X, y);
    if (bestFeature === -1) {
      const majority = unique.sort((a, b) => y.filter(v => v === b).length - y.filter(v => v === a).length)[0];
      output += `<div>- Node lá (không thể tách tiếp): chọn nhãn phổ biến nhất '${majority}'</div><br>`;
      return { type: 'leaf', label: majority };
    }

    output += `<div>- Tách tốt nhất: x[${bestFeature}] ≤ ${bestThreshold.toFixed(3)}</div><hr>`;
    const { leftX, leftY, rightX, rightY } = split(X, y, bestFeature, bestThreshold);

    return {
      type: 'node',
      feature: bestFeature,
      threshold: bestThreshold,
      left: buildTree(leftX, leftY, depth + 1),
      right: buildTree(rightX, rightY, depth + 1)
    };
  }

  const tree = buildTree(X, y);

  output += `<div class="section-title">Cây quyết định (dạng văn bản)</div>`;
  function renderTree(node, indent = 0) {
    const pad = '&nbsp;'.repeat(indent * 4);
    if (node.type === 'leaf') return `${pad}<b>→ ${node.label}</b><br>`;
    return `${pad}if x[${node.feature}] ≤ ${node.threshold.toFixed(3)}:<br>` +
           renderTree(node.left, indent + 1) +
           `${pad}else:<br>` +
           renderTree(node.right, indent + 1);
  }
  output += `<pre style="font-family: monospace">${renderTree(tree)}</pre>`;

  // Dự đoán
  function predict(node, testX) {
    if (node.type === 'leaf') return node.label;
    return testX[node.feature] <= node.threshold
      ? predict(node.left, testX)
      : predict(node.right, testX);
  }

  const predictedLabel = predict(tree, testX);
  output += `<div class="section-title">Dự đoán cho dữ liệu test</div>`;
  output += `<div><b>Dữ liệu test:</b> [${testX.map(x => x.toFixed(3)).join(', ')}]</div>`;
  output += `<div><b>Kết quả dự đoán:</b> ${predictedLabel}</div>`;

  return output;
}

//Thuật toán Hồi quy tuyến tính
function explainLinearRegression(X_raw, y, testX) {
  const m = X_raw.length;
  const n = X_raw[0].length;

  const X = X_raw;
  const y_sum = y.reduce((a, b) => a + b, 0);

  const X_matrix = X.map(row => [1, ...row]); // thêm cột bias 1
  const XT = math.transpose(X_matrix);
  const XT_X = math.multiply(XT, X_matrix);
  const XT_y = math.multiply(XT, y);
  const w_vector = math.multiply(math.inv(XT_X), XT_y); // trọng số [w0, w1, ..., wn]

  let steps = "";

  // Cách 1: Đạo hàm để tìm hệ phương trình
  steps += `<div class="section-subtitle">Sử dụng đạo hàm để tìm hệ phương trình hồi quy tuyến tính</div>`;
  steps += `
    <p>Ta giả sử phương trình hồi quy tuyến tính có dạng:</p>
    <p>\\[
      \\hat{y}^{(i)} = w_0 + w_1 x_1^{(i)} + w_2 x_2^{(i)} + \\dots + w_n x_n^{(i)}
    \\]</p>
    <p>Hàm mất mát (hàm chi phí) là tổng bình phương sai số:</p>
    <p>\\[
      J(w) = \\sum_{i=1}^m (y^{(i)} - \\hat{y}^{(i)})^2
    \\]</p>
    <p>Thay \\( \\hat{y}^{(i)} \\) vào, ta được:</p>
    <p>\\[
      J(w) = \\sum_{i=1}^m \\left( y^{(i)} - \\left( w_0 + \\sum_{j=1}^n w_j x_j^{(i)} \\right) \\right)^2
    \\]</p>
    <p>Để tìm giá trị \\( w \\) tối ưu, ta lấy đạo hàm riêng của \\( J(w) \\) theo từng \\( w_k \\), rồi đặt bằng 0:</p>
    <p>\\[
      \\frac{\\partial J}{\\partial w_k} = -2 \\sum_{i=1}^m \\left( y^{(i)} - \\left( w_0 + \\sum_{j=1}^n w_j x_j^{(i)} \\right) \\right) x_k^{(i)} = 0
    \\]</p>
    <p>Với \\( x_0^{(i)} = 1 \\) để xử lý bias \\( w_0 \\), ta viết lại thành:</p>
    <p>\\[
      \\sum_{i=1}^m \\left( y^{(i)} - \\sum_{j=0}^n w_j x_j^{(i)} \\right) x_k^{(i)} = 0, \\quad \\text{với } k = 0, 1, ..., n
    \\]</p>
    <p>Từ đây, ta thu được hệ \\( n+1 \\) phương trình tuyến tính theo \\( w_0, w_1, ..., w_n \\), được viết dưới dạng ma trận:</p>
    <p>\\[
      X^T X w = X^T y
    \\]</p>
    <p>Giải hệ này ta sẽ thu được nghiệm duy nhất (nếu \\( X^T X \\) khả nghịch):</p>
    <p>\\[
      w = (X^T X)^{-1} X^T y
    \\]</p>
  `;
  steps += `
    <p>Ta giải theo công thức:</p>
    <p>\\[
      w = (X^T X)^{-1} X^T y
    \\]</p>
    <p>Với:</p>
    <p>\\[
      X = \\begin{bmatrix}
        1 & ${X[0].join(" & ")} \\\\
        1 & ${X[1].join(" & ")} \\\\
        1 & ${X[2].join(" & ")} \\\\
        1 & ${X[3].join(" & ")}
      \\end{bmatrix},
      \\quad
      y = \\begin{bmatrix}
        ${y.join(" \\\\ ")}
      \\end{bmatrix}
    \\]</p>
  `;

  // Chi tiết giải hệ
  steps += `<div class="section-subtitle mt-4">Chi tiết quá trình giải hệ phương trình</div>`;
  steps += `
    <p>Bắt đầu với ma trận đầu vào:</p>
    <p>\\[
      X = \\begin{bmatrix}
        1 & ${X[0].join(" & ")} \\\\
        1 & ${X[1].join(" & ")} \\\\
        1 & ${X[2].join(" & ")} \\\\
        1 & ${X[3].join(" & ")}
      \\end{bmatrix}
    \\]</p>
    <p>\\[
      y = \\begin{bmatrix}
        ${y.map(val => val.toFixed(2)).join(" \\\\ ")}
      \\end{bmatrix}
    \\]</p>
  `;

  steps += `
    <p>Tính ma trận chuyển vị của X: \\( X^T \\)</p>
    <p>\\[
      X^T = \\begin{bmatrix}
        ${XT[0].join(" & ")} \\\\
        ${XT[1].join(" & ")} \\\\
        ${XT[2].join(" & ")}
      \\end{bmatrix}
    \\]</p>
  `;

  steps += `
    <p>Tính \\( X^T X \\):</p>
    <p>\\[
      X^T X = \\begin{bmatrix}
        ${XT_X[0].map(e => e.toFixed(2)).join(" & ")} \\\\
        ${XT_X[1].map(e => e.toFixed(2)).join(" & ")} \\\\
        ${XT_X[2].map(e => e.toFixed(2)).join(" & ")}
      \\end{bmatrix}
    \\]</p>
  `;

  steps += `
    <p>Tính \\( X^T y \\):</p>
    <p>\\[
      X^T y = \\begin{bmatrix}
        ${XT_y.map(e => e.toFixed(2)).join(" \\\\ ")}
      \\end{bmatrix}
    \\]</p>
  `;

  steps += `
    <p>Giải hệ phương trình \\( X^T X w = X^T y \\):</p>
    <p>1. Tính nghịch đảo \\( (X^T X)^{-1} \\)</p>
    <p>\\[
      (X^T X)^{-1} = \\begin{bmatrix}
        ${math.inv(XT_X).map(row => row.map(e => e.toFixed(3)).join(" & ")).join(" \\\\ ")}
      \\end{bmatrix}
    \\]</p>
    <p>2. Nhân với \\( X^T y \\) để tìm vector trọng số \\( w \\):</p>
    <p>\\[
      w = (X^T X)^{-1} X^T y = \\begin{bmatrix}
        ${w_vector.map(w => w.toFixed(3)).join(" \\\\ ")}
      \\end{bmatrix}
    \\]</p>
  `;

  steps += `
    <p>Sau khi tính toán, ta được:</p>
    <p>\\[
      w = \\begin{bmatrix}
        ${w_vector.map(w => w.toFixed(3)).join(" \\\\ ")}
      \\end{bmatrix}
    \\]</p>
    <p>⇒ Phương trình hồi quy:</p>
    <p style="color: red; font-weight: bold;">\\[
      \\hat{y} = ${w_vector[0].toFixed(3)} + ${w_vector.slice(1).map((w, i) => `${w.toFixed(3)}x_${i + 1}`).join(" + ")}
    \\]</p>
  `;

  // Dự đoán
  const y_pred = w_vector[0] + testX.reduce((sum, xi, i) => sum + xi * w_vector[i + 1], 0);
  steps += `<div class="section-subtitle mt-4">Dự đoán giá trị cho dữ liệu test</div>`;
  steps += `
    <p>Với đầu vào test là: \\( x = [${testX.join(", ")}] \\)</p>
    <p>
      \\[
        \\hat{y} = ${w_vector[0].toFixed(3)} + ${testX.map((xi, i) => `${w_vector[i + 1].toFixed(3)} \\times ${xi}`).join(" + ")} = ${y_pred.toFixed(3)}
      \\]
    </p>

  `;

  setTimeout(() => window.MathJax?.typeset(), 0);
  return steps;
}

//Thuật toán Hồi quy Logistic
function explainLogisticRegression(X, y, testX, learningRate = 0.1, maxIter = 5) {
  let output = `<div class="section-title">Hồi quy Logistic (Logistic Regression)</div>`;

  const sigmoid = z => 1 / (1 + Math.exp(-z));
  const addBias = X => X.map(row => [1, ...row]); // Thêm bias
  const Xb = addBias(X);
  const testXb = [1, ...testX];
  let weights = Array(Xb[0].length).fill(0); // Khởi tạo w = 0

  output += `
    <div class="formula">
      <p>Hàm sigmoid (hàm kích hoạt):</p>
      <p>\\[ \\sigma(z) = \\frac{1}{1 + e^{-z}} \\]</p>
      <p>Hàm log-likelihood (hàm mục tiêu tối đa hóa):</p>
      <p>\\[
          \\mathcal{L}(w) = \\sum_{i=1}^n \\left[
            y_i \\log(\\hat{y}_i) + (1 - y_i) \\log(1 - \\hat{y}_i)
          \\right]
      \\]</p>
      <p>Trong đó: \\( \\hat{y}_i = \\sigma(z_i) = \\sigma(w^T x_i) \\)</p>
    </div>
  `;

  output += `
    <div class="explanation">
      <p><b>Bước 1: Viết lại hàm log-likelihood:</b></p>
      <p>\\[
          \\mathcal{L}(w) = \\sum_{i=1}^n \\left[
            y_i \\log \\sigma(w^T x_i) + (1 - y_i) \\log(1 - \\sigma(w^T x_i))
          \\right]
      \\]</p>
      <p><b>Bước 2: Tính đạo hàm của hàm log-likelihood theo mỗi trọng số \\( w_j \\):</b></p>
      <p>Để tối đa hàm log-likelihood, ta tính gradient \\( \\nabla_w \\mathcal{L} \\):</p>
      <p>Đạo hàm từng phần:</p>
      <p>\\[
        \\frac{\\partial \\mathcal{L}}{\\partial w_j} = 
        \\sum_{i=1}^n \\frac{\\partial}{\\partial w_j} \\left[
          y_i \\log \\hat{y}_i + (1 - y_i) \\log (1 - \\hat{y}_i)
        \\right]
      \\]</p>
    </div>
  `;

  output += `
    <div class="explanation">
      <p><b>Bước 3: Đạo hàm bên trong:</b></p>
      <p>Vì \\( \\hat{y}_i = \\sigma(z_i) \\) và \\( z_i = w^T x_i = \\sum_{k} w_k x_{ik} \\), ta dùng quy tắc chuỗi:</p>
      <p>\\[
        \\frac{\\partial}{\\partial w_j} \\log \\hat{y}_i = \\frac{1}{\\hat{y}_i} \\cdot \\frac{\\partial \\hat{y}_i}{\\partial w_j}, \\quad
        \\frac{\\partial}{\\partial w_j} \\log(1 - \\hat{y}_i) = -\\frac{1}{1 - \\hat{y}_i} \\cdot \\frac{\\partial \\hat{y}_i}{\\partial w_j}
      \\]</p>
      <p>Đạo hàm của sigmoid:</p>
      <p>\\[
        \\frac{\\partial \\hat{y}_i}{\\partial w_j} = \\frac{\\partial \\sigma(z_i)}{\\partial z_i} \\cdot \\frac{\\partial z_i}{\\partial w_j}
        = \\sigma(z_i)(1 - \\sigma(z_i)) x_{ij} = \\hat{y}_i (1 - \\hat{y}_i) x_{ij}
      \\]</p>
    </div>
  `;

  output += `
    <div class="explanation">
      <p><b>Bước 4: Thế lại và đơn giản hóa:</b></p>
      <p>Thế vào công thức đạo hàm tổng quát:</p>
      <p>\\[
        \\frac{\\partial \\mathcal{L}}{\\partial w_j} =
        \\sum_{i=1}^n \\left[
          y_i \\frac{1}{\\hat{y}_i} \\hat{y}_i (1 - \\hat{y}_i) x_{ij} 
          - (1 - y_i) \\frac{1}{1 - \\hat{y}_i} \\hat{y}_i (1 - \\hat{y}_i) x_{ij}
        \\right]
      \\]</p>
      <p>Rút gọn:</p>
      <p>\\[
        = \\sum_{i=1}^n (y_i (1 - \\hat{y}_i) - (1 - y_i) \\hat{y}_i) x_{ij} 
        = \\sum_{i=1}^n (y_i - y_i \\hat{y}_i - \\hat{y}_i + y_i \\hat{y}_i) x_{ij}
      \\]</p>
      <p>Tiếp tục đơn giản:</p>
      <p>\\[
        = \\sum_{i=1}^n (y_i - \\hat{y}_i) x_{ij}
      \\]</p>
    </div>
  `;

  output += `
    <div class="explanation">
      <p><b>Kết luận:</b></p>
      <p>Gradient của hàm log-likelihood theo trọng số \\( w_j \\) là:</p>
      <p>\\[
        \\frac{\\partial \\mathcal{L}}{\\partial w_j} = \\sum_{i=1}^n (y_i - \\hat{y}_i) x_{ij}
      \\]</p>
      <p><b>Bước 5: Cập nhật trọng số:</b></p>
      <p>Ta cập nhật trọng số theo gradient ascent:</p>
      <p>\\[
        w_j^{(t+1)} = w_j^{(t)} + \\alpha \\frac{\\partial \\mathcal{L}}{\\partial w_j}
      \\]</p>
      <p>Trong đó \\( \\alpha \\) là tốc độ học (learning rate).</p>
    </div>
  `;

  for (let iter = 0; iter < maxIter; iter++) {
    // Tính dự đoán yHat cho mỗi mẫu
    let predictions = Xb.map(row => sigmoid(row.reduce((sum, xi, j) => sum + xi * weights[j], 0)));

    // Tính gradient
    let gradients = Array(weights.length).fill(0);
    for (let j = 0; j < weights.length; j++) {
      gradients[j] = Xb.reduce((sum, row, i) => sum + (y[i] - predictions[i]) * row[j], 0);
    }

    // Hiển thị từng bước tính gradient cho từng trọng số
    output += `<div class="section-title">Lần lặp ${iter + 1}</div>`;

    output += `<p><b>Tính giá trị \\( z_i = w^T x_i \\) và \\( \\hat{y}_i = \\sigma(z_i) \\) cho mỗi mẫu:</b></p>`;
    predictions.forEach((p, i) => {
      const zVal = Xb[i].reduce((sum, xi, j) => sum + xi * weights[j], 0);
      output += `<p>Mẫu ${i + 1}: \\( z = ${Xb[i].map((xi, j) => `${xi.toFixed(4)} \\times ${weights[j].toFixed(4)}`).join(" + ")} = ${zVal.toFixed(4)} \\), \\( \\hat{y} = ${p.toFixed(4)} \\), \\( y = ${y[i]} \\)</p>`;
    });

    output += `<p><b>Tính gradient \\( \\frac{\\partial \\mathcal{L}}{\\partial w_j} = \\sum_i (y_i - \\hat{y}_i) x_{ij} \\):</b></p>`;
    for (let j = 0; j < weights.length; j++) {
      let terms = Xb.map((row, i) => `(${y[i]} - ${predictions[i].toFixed(4)}) \\times ${row[j].toFixed(4)}`).join(" + ");
      output += `<p>Gradient w<sub>${j}</sub>: \\( \\sum_i (y_i - \\hat{y}_i) x_{i${j}} = ${terms} = ${gradients[j].toFixed(4)} \\)</p>`;
    }

    // Cập nhật trọng số
    weights = weights.map((w, j) => w + learningRate * gradients[j]);

    output += `<p><b>Cập nhật trọng số:</b></p>`;
    output += `<p>\\( w_j = w_j + \\alpha \\times \\text{gradient} = ${weights.map(w => w.toFixed(4)).join(", ")} \\)</p>`;

    // Tính log-likelihood hiện tại
    const logLik = Xb.reduce((sum, row, i) => {
      const yHat = sigmoid(row.reduce((s, xi, j) => s + xi * weights[j], 0));
      return sum + y[i] * Math.log(yHat) + (1 - y[i]) * Math.log(1 - yHat);
    }, 0).toFixed(4);

    output += `<p><b>Log-likelihood hiện tại:</b> \\( ${logLik} \\)</p>`;
  }
  output += `
    <p><b>Phương trình hồi quy logistic cuối cùng:</b></p>
    <p style="color: red; font-weight: bold;">
      \\[
        \\hat{y} = \\sigma(w_0 + ${weights.slice(1).map((w, j) => `${w >= 0 ? '+' : ''}${w.toFixed(4)} \\cdot x_${j + 1}`).join(' ')} )
      \\]
      với \\(\\sigma(z) = \\frac{1}{1 + e^{-z}}\\)
    </p>
  `;


  // Dự đoán với testX
    output += `<div class="section-title">Dự đoán với testX</div>`;

    // Thêm bias vào testX
    const testXbSingle = [1, ...testX];
    const z = testXbSingle.reduce((sum, xi, j) => sum + xi * weights[j], 0);
    const yHat = sigmoid(z);
    const predicted = yHat >= 0.5 ? 1 : 0;

    output += `<div>\\( z = ${testXbSingle.map((xi, j) => `${xi.toFixed(4)} \\cdot ${weights[j].toFixed(4)}`).join(" + ")} = ${z.toFixed(4)} \\)</div>`;
    output += `<div>\\( \\hat{y} = \\sigma(${z.toFixed(4)}) = ${yHat.toFixed(4)} \\)</div>`;
    output += `
        <div style="margin-top: 20px;">
          <b>Bảng xác suất thuộc mỗi lớp nhãn:</b>
          <table style="
            border-collapse: collapse;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            margin-top: 10px;
            box-shadow: 0 0 4px rgba(0,0,0,0.2);
          ">
            <thead style="background-color: #d9ead3; text-align: center;">
              <tr>
                <th style="border: 1px solid #999; padding: 8px 12px; min-width: 80px;">Lớp</th>
                <th style="border: 1px solid #999; padding: 8px 12px; min-width: 150px;">Xác suất</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #999; padding: 8px 12px; text-align: center;">0</td>
                <td style="border: 1px solid #999; padding: 8px 12px; text-align: right;">${((1 - yHat) * 100).toFixed(2)}%</td>
              </tr>
              <tr>
                <td style="border: 1px solid #999; padding: 8px 12px; text-align: center;">1</td>
                <td style="border: 1px solid #999; padding: 8px 12px; text-align: right;">${(yHat * 100).toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;



    output += `<div><b>Phân lớp dự đoán:</b> ${predicted}</div>`;


  // Kích hoạt MathJax render công thức LaTeX
  setTimeout(() => {
    if (window.MathJax) MathJax.typeset();
  }, 0);

  return output;
}
