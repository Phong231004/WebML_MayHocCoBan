async function runAlgorithmunsuperviseddata() {
    const trainFile = document.getElementById("fileInputunsuperviseddata").files[0];
    const testFile = document.getElementById("testFileInputunsuperviseddata").files[0];
    const algo = document.getElementById("unsupervisedAlgorithm").value;
  
    if (!trainFile || !testFile) {
      alert("Vui lòng chọn cả file huấn luyện và test!");
      return;
    }
  
    try {
      const trainData = await readExcelFile(trainFile);
      const testData = await readExcelFile(testFile);
  
      const trainRows = trainData.slice(1).map(row => row.map(Number));
      const testRows = testData.slice(1).map(row => row.map(Number));
  
      let output = `
        <div class="section-title">1. Dữ liệu huấn luyện</div>
        ${generateTableHTML(trainData[0], trainRows)}
        <div class="section-title mt-4">2. Dữ liệu cần phân cụm</div>
        ${generateTableHTML(testData[0], testRows)}
      `;
  
      if (algo === "Kmeans") {
        output +=`
          <div class="alert alert-warning mt-3" role="alert">
            <strong>Lưu ý:</strong> Bạn tham khảo đồ thị Elbow để điều chỉnh tham số <b>K</b> cho mô hình Kmeans.
          </div>
          `
        const kmeansHTML = await runKMeansClustering(trainRows, testRows);
        output += kmeansHTML;
      } else if (algo === "HierarchicalClustering") {
        output += runHierarchicalClustering(trainRows, testRows);
      }
      document.getElementById("resultBox").innerHTML = output;

      // Xử lý MathJax
      if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById("resultBox")])
          .catch((err) => console.error("MathJax render error:", err));
      }
      
    } catch (err) {
      alert("Lỗi xử lý file: " + err);
    }
  }
//   Hàm Kmeans
// Hàm tính khoảng cách Euclidean
function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}
// Biến toàn cục lưu instance biểu đồ
let elbowChartInstance = null;
// Hàm vẽ Elbow chart – THÊM THAM SỐ canvasId (default: 'elbowChart')
function generateElbowChart(trainRows, canvasId = "elbowChart") {
  const maxK = Math.min(100, trainRows.length);  // tránh tạo nhiều cụm hơn số điểm
  const inertias = [];

  if (trainRows.length < 2) {
    alert("Không đủ dữ liệu để vẽ biểu đồ Elbow. Cần ít nhất 2 dòng.");
    return;
  }

  for (let k = 1; k <= maxK; k++) {
    try {
      const centroids = [];
      const usedIndexes = new Set();

      while (centroids.length < k) {
        const idx = Math.floor(Math.random() * trainRows.length);
        if (!usedIndexes.has(idx)) {
          centroids.push([...trainRows[idx]]);
          usedIndexes.add(idx);
        }
      }

      const assignments = [];
      for (let i = 0; i < trainRows.length; i++) {
        const dists = centroids.map(c => euclideanDistance(trainRows[i], c));
        const nearest = dists.indexOf(Math.min(...dists));
        assignments[i] = nearest;
      }

      const newCentroids = Array.from({ length: k }, () => []);
      for (let i = 0; i < trainRows.length; i++) {
        newCentroids[assignments[i]].push(trainRows[i]);
      }

      for (let i = 0; i < k; i++) {
        if (newCentroids[i].length > 0) {
          centroids[i] = calculateMean(newCentroids[i]);
        }
      }

      let inertia = 0;
      for (let i = 0; i < trainRows.length; i++) {
        const dist = euclideanDistance(trainRows[i], centroids[assignments[i]]);
        inertia += dist ** 2;
      }

      inertias.push(inertia);
    } catch (e) {
      console.error("Lỗi khi tính inertia với k =", k, e);
      inertias.push(NaN);
    }
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    alert("Không tìm thấy phần tử " + canvasId);
    return;
  }

  const ctx = canvas.getContext("2d");

  if (elbowChartInstance) {
    elbowChartInstance.destroy();
  }

  elbowChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: maxK }, (_, i) => i + 1),
      datasets: [{
        label: "Inertia",
        data: inertias,
        borderColor: "blue",
        fill: false,
        tension: 0.3,
        pointBackgroundColor: "red"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Biểu đồ Elbow (Inertia vs K)"
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Số cụm (K)"
          }
        },
        y: {
          title: {
            display: true,
            text: "Tổng bình phương khoảng cách (Inertia)"
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Hàm tính trung bình một cụm
function calculateMean(points) {
    const sum = points[0].map(() => 0);
    points.forEach(p => {
        p.forEach((val, i) => sum[i] += val);
    });
    return sum.map(x => x / points.length);
}

// Escape HTML để tránh lỗi khi nhúng công thức
function escapeHTML(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Hàm tạo công thức chi tiết khoảng cách
function generateDistanceFormula(x, c, result) {
    const terms = x.map((xi, i) => `(${xi.toFixed(3)} - ${c[i].toFixed(3)})^2`).join(' + ');
    const stepLines = x.map((xi, i) => `(${xi.toFixed(3)} - ${c[i].toFixed(3)})^2 = ${((xi - c[i]) ** 2).toFixed(3)}`);
    const totalValue = x.reduce((s, _, i) => s + Math.pow(x[i] - c[i], 2), 0);
    const total = `Tổng = ${stepLines.map(s => s.split(' = ')[1]).join(' + ')} = ${totalValue.toFixed(3)}`;
    const sqrt = `\\sqrt{${totalValue.toFixed(3)}} = ${result.toFixed(3)}`;
  
    return [
      `d(\\mathbf{x}, \\mathbf{c}) = \\sqrt{${terms}}`,
      ...stepLines,
      total,
      sqrt
    ];
  }
  
// Hiển thị công thức chi tiết khi click
function showDistanceFormula(latexLines, pointX, pointC) {
    const formattedLatex = latexLines.map(line => `\\[${line}\\]`).join('\n');
  
    const content = `
      <b>Điểm kiểm tra:</b> [${pointX.map(x => x.toFixed(3)).join(', ')}]<br/>
      <b>Tâm cụm:</b> [${pointC.map(x => x.toFixed(3)).join(', ')}]<br/><hr/>
      <b>Chi tiết công thức:</b>
      <div class="bg-light p-3 rounded" style="white-space: normal; overflow-x: auto;">
        ${formattedLatex}
      </div>
    `;
  
    document.getElementById("distanceModalContent").innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById("distanceModal"));
    modal.show();
    if (window.MathJax) MathJax.typesetPromise();
  }
  
// Hàm chính xử lý K-means và hiển thị từng bước
async  function runKMeansClustering(trainRows, testRows) {
    const k = parseInt(document.getElementById("kValueKMeans").value);
    let html = '';

    // Cơ sở lý thuyết
    html += `
        <div class="section-title mt-4">3. Cơ sở lý thuyết thuật toán K-means</div>
        <div class="mb-3" style="line-height: 1.7; background-color:rgb(253, 253, 236); padding: 15px; border-radius: 6px;">
        <p style="color:rgb(255, 0, 0);">1. Mục tiêu chính:</p>
        <p>K-Means là thuật toán học không giám sát, dùng để phân cụm dữ liệu thành <b>K</b> nhóm (cluster), 
        sao cho các điểm dữ liệu trong cùng một nhóm là "gần nhau" nhất có thể, và khác biệt với các nhóm khác.</p>
    
        <p style="color:rgb(255, 0, 0);">2. Biểu diễn toán học:</p>
        <p>Giả sử tập dữ liệu đầu vào gồm <b>n</b> điểm dữ liệu:</p>
        <p>
            \\[
            X = \\{ x_1, x_2, ..., x_n \\},\\quad x_i \\in \\mathbb{R}^d
            \\]
        </p>
        <p>Phân chia thành <b>K</b> cụm \\( C_1, C_2, ..., C_K \\) sao cho:</p>
        <p>
            \\[
            \\min_C \\sum_{k=1}^{K} \\sum_{x_i \\in C_k} \\| x_i - \\mu_k \\|^2
            \\]
        </p>
        <p>Trong đó:</p>
        <ul>
            <li>\\( \\mu_k \\): tâm cụm thứ \\( k \\)</li>
            <li>\\( \\| x_i - \\mu_k \\|^2 \\): khoảng cách bình phương giữa điểm \\( x_i \\) và tâm cụm \\( \\mu_k \\)</li>
        </ul>
    
        <p style="color:rgb(255, 0, 0);">3. Công thức cập nhật:</p>
        <p style="color:rgb(255, 0, 0);">3.1. Gán cụm (Assignment step):</p>
        <p>
            \\[
            C_k = \\{ x_i : \\| x_i - \\mu_k \\|^2 \\leq \\| x_i - \\mu_j \\|^2,\\ \\forall j = 1,...,K \\}
            \\]
        </p>
        <p style="color:rgb(255, 0, 0);">3.2. Cập nhật tâm cụm (Update step):</p>
        <p>
            \\[
            \\mu_k = \\frac{1}{|C_k|} \\sum_{x_i \\in C_k} x_i
            \\]
        </p>
    
        <p style="color:rgb(255, 0, 0);">4. Thuật toán K-means – Tóm tắt:</p>
        <ul>
            <li>Chọn K tâm cụm ban đầu (random hoặc dùng K-means++...)</li>
            <li>Lặp lại cho đến khi hội tụ:
            <ul>
                <li>Gán mỗi điểm vào cụm gần nhất</li>
                <li>Tính lại tâm cụm</li>
            </ul>
            </li>
        </ul>
    
        <p style="color:rgb(255, 0, 0);">5. Khoảng cách Euclidean:</p>
        <p>Trong không gian \\( d \\) chiều, khoảng cách giữa 2 điểm \\( x = (x_1,...,x_d) \\) và \\( y = (y_1,...,y_d) \\):</p>
        <p>
            \\[
            \\| x - y \\| = \\sqrt{\\sum_{i=1}^{d} (x_i - y_i)^2}
            \\]
        </p>
        </div>
    `;
    // Khởi tạo tâm cụm ngẫu nhiên
    let centroids = [];
    const usedIndexes = new Set();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * trainRows.length);
        if (!usedIndexes.has(idx)) {
            centroids.push([...trainRows[idx]]);
            usedIndexes.add(idx);
        }
    }

    html += `<div class="section-title mt-4">4. Tâm cụm ban đầu</div><ul>`;
    centroids.forEach((c, i) => {
        html += `<li>Cụm ${i}: ${JSON.stringify(c)}</li>`;
    });
    html += `</ul>`;

    let assignments = new Array(trainRows.length).fill(-1);
    let changed = true;
    let iteration = 0;
    const maxIterations = 100;

    while (changed && iteration < maxIterations) {
        changed = false;
        iteration++;

        html += `<div class="section-title mt-4">Lặp ${iteration}</div>`;
        html += `<table class="result-table"><thead><tr><th>STT</th><th>Điểm dữ liệu</th>${centroids.map((_, i) => `<th>d(x, C${i})</th>`).join('')}<th>Cụm gán</th></tr></thead><tbody>`;

        for (let i = 0; i < trainRows.length; i++) {
            const row = trainRows[i];
            const dists = centroids.map(c => euclideanDistance(row, c));
            const nearest = dists.indexOf(Math.min(...dists));
            if (assignments[i] !== nearest) {
                changed = true;
                assignments[i] = nearest;
            }

            html += `<tr><td>${i + 1}</td><td>${JSON.stringify(row)}</td>`;
            dists.forEach((d, j) => {
                const formulaLines = generateDistanceFormula(row, centroids[j], d); // mảng các dòng LaTeX
                html += `<td><a href="javascript:void(0)" onclick='showDistanceFormula(${JSON.stringify(formulaLines)}, ${JSON.stringify(row)}, ${JSON.stringify(centroids[j])})'>${d.toFixed(4)}</a></td>`;
              });
                          
            html += `<td><b>C${nearest}</b></td></tr>`;
        }

        html += `</tbody></table>`;

        // Cập nhật tâm cụm
        const newCentroids = Array.from({ length: k }, () => []);
        for (let i = 0; i < trainRows.length; i++) {
            const cluster = assignments[i];
            newCentroids[cluster].push(trainRows[i]);
        }

        html += `<div><b>Cập nhật tâm cụm:</b><ul>`;
        for (let i = 0; i < k; i++) {
            if (newCentroids[i].length > 0) {
                const updated = calculateMean(newCentroids[i]);
                const rounded = updated.map(val => Number(val.toFixed(3)));
                html += `<li>Cụm ${i}: Trung bình ${newCentroids[i].length} điểm → [${rounded.join(', ')}]</li>`;
                centroids[i] = updated;
            }
        }
        html += `</ul></div>`;
    }

    html += `<div class="section-title mt-4">5. Tâm cụm sau ${iteration} vòng lặp</div><ul>`;
    centroids.forEach((c, i) => {
        const rounded = c.map(val => Number(val.toFixed(3)));
        html += `<li>C${i}: [${rounded.join(', ')}]</li>`;
      });      
    html += `</ul>`;

    // Dự đoán cho test
    const testAssignments = testRows.map(row => {
        const dists = centroids.map(c => euclideanDistance(row, c));
        return dists.indexOf(Math.min(...dists));
    });

    html += `<div class="section-title mt-4">6. Phân cụm dữ liệu test</div>`;
    html += `<table class="result-table"><thead><tr><th>STT</th><th>Dữ liệu</th>${centroids.map((_, i) => `<th>d(x, C${i})</th>`).join('')}<th>Cụm gán</th></tr></thead><tbody>`;
    
    testRows.forEach((row, i) => {
        const dists = centroids.map(c => euclideanDistance(row, c));
        const nearest = dists.indexOf(Math.min(...dists));
    
        html += `<tr><td>${i + 1}</td><td>${JSON.stringify(row)}</td>`;
    
        dists.forEach((d, j) => {
            const formulaLines = generateDistanceFormula(row, centroids[j], d);
            html += `<td><a href="javascript:void(0)" onclick='showDistanceFormula(${JSON.stringify(formulaLines)}, ${JSON.stringify(row)}, ${JSON.stringify(centroids[j])})'>${d.toFixed(3)}</a></td>`;
        });
    
        html += `<td><b>C${nearest}</b></td></tr>`;
    });
    
    html += `</tbody></table>`;
    

    // Nơi hiển thị công thức khi bấm
    html += `<div id="distanceFormulaBox" class="mt-4 p-3 border bg-light rounded" style="display: none;"></div>`;
    
    html += `
      <div class="section-title mt-4">7. Biểu đồ Elbow</div>
        <div class="bg-light p-3 rounded mb-4" style="line-height: 1.7;">
          <p style="color:rgb(255, 0, 0);">1. Định nghĩa WCSS:</p>
          <p>
            WCSS là tổng bình phương khoảng cách từ các điểm dữ liệu đến tâm cụm của chúng:
          </p>
          <p>
            \\[
            WCSS = \\sum_{k=1}^{K} \\sum_{x_i \\in C_k} \\| x_i - \\mu_k \\|^2
            \\]
          </p>
          <p>
            – <b>K</b>: số cụm<br/>
            – <b>C<sub>k</sub></b>: cụm thứ k<br/>
            – <b>μ<sub>k</sub></b>: tâm cụm thứ k<br/>
            – <b>x<sub>i</sub></b>: điểm dữ liệu trong cụm
          </p>

          <p style="color:rgb(255, 0, 0);">2. Ý tưởng biểu đồ Elbow:</p>
          <p>
            – Chạy KMeans với nhiều giá trị <b>K</b> (thường từ 1 → 10), ta tính được WCSS tương ứng.<br/>
            – WCSS luôn giảm khi tăng <b>K</b>, nhưng mức giảm sẽ nhỏ dần.<br/>
            – Vẽ biểu đồ với trục hoành là <b>K</b>, trục tung là <b>WCSS</b>.<br/>
            – Điểm gãy (khuỷu tay) thể hiện vị trí mà việc tăng thêm cụm không giảm đáng kể WCSS nữa.
          </p>

          <p style="color:rgb(255, 0, 0);">3. Chọn K theo Elbow:</p>
          <p>
            – Chọn <b>K</b> tại vị trí "khuỷu tay" – nơi độ giảm WCSS bắt đầu chậm lại rõ rệt.<br/>
            – Giúp tránh <i>overfitting</i> (phân quá nhiều cụm không cần thiết).
          </p>
        </div>
      <div class="chart-container">
        <canvas id="elbowChartKMeans"></canvas>
      </div>

    `;

    // Gán toàn bộ html ra giao diện
    document.getElementById("resultBox").innerHTML = html;

    setTimeout(() => {
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([document.getElementById("resultBox")]);
      }
    }, 0);
    setTimeout(() => {
      generateElbowChart(trainRows, 'elbowChartKMeans');
    }, 0);
    return html;
    
}
// ===== HÀM PHÂN CẤP =====
function hierarchicalClusteringBuildTree(trainRows, linkage = "single") {
  let clusters = trainRows.map((_, idx) => ({
    id: idx,
    points: [idx],
    left: null,
    right: null,
    height: 0
  }));

  function clusterDistance(c1, c2) {
    let dists = [];
    for (let i of c1.points) {
      for (let j of c2.points) {
        dists.push(euclideanDistance(trainRows[i], trainRows[j]));
      }
    }
    return linkage === "single" ? Math.min(...dists) : Math.max(...dists);
  }

  let nextClusterId = trainRows.length;
  while (clusters.length > 1) {
    let minDist = Infinity;
    let mergeA = -1, mergeB = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = clusterDistance(clusters[i], clusters[j]);
        if (dist < minDist) {
          minDist = dist;
          mergeA = i;
          mergeB = j;
        }
      }
    }

    const newCluster = {
      id: nextClusterId++,
      points: [...clusters[mergeA].points, ...clusters[mergeB].points],
      left: clusters[mergeA],
      right: clusters[mergeB],
      height: minDist
    };

    clusters.splice(mergeB, 1);
    clusters.splice(mergeA, 1);
    clusters.push(newCluster);
  }

  return clusters[0]; // Gốc cây
}

function cutTree(root, k) {
  const queue = [root];
  while (queue.length < k && queue.some(n => n.left && n.right)) {
    const max = queue.reduce((a, b) => (a.height > b.height ? a : b));
    const index = queue.indexOf(max);
    queue.splice(index, 1, max.left, max.right);
  }
  return queue.map(c => c.points);
}

function predictTestClusters(testRows, trainRows, clusterGroups) {
  const euclidean = (a, b) =>
    Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));

  const centroids = clusterGroups.map(group =>
    calculateMean(group.map(i => trainRows[i]))
  );

  const labels = [];
  const distanceMatrix = [];

  testRows.forEach((row) => {
    const dists = centroids.map(centroid => euclidean(row, centroid));
    labels.push(dists.indexOf(Math.min(...dists)));
    distanceMatrix.push(dists);
  });

  return { labels, distanceMatrix, centroids };
}


// ===== CHẠY PHÂN CỤM PHÂN CẤP =====
function runHierarchicalClustering(trainRows, testRows) {
  const strategy = document.getElementById("Hcl").value;
  const linkage = strategy === "Bottomup" ? "single" : "complete";

  const tree = hierarchicalClusteringBuildTree(trainRows, linkage);
  let html = `
    <div class="section-title mt-4">3. Cơ sở lý thuyết</div>
    <div class="mt-4" style="line-height: 1.7; background-color:rgb(253, 253, 236); padding: 15px; border-radius: 6px;">
      <div>
      <p>-  Hierarchical Clustering (Phân cụm phân cấp) là một thuật toán học không giám sát được sử dụng để nhóm các đối tượng thành các cụm (clusters) dựa trên mức độ tương đồng giữa chúng. Thuật toán xây dựng cấu trúc phân cấp dạng cây gọi là dendrogram, cho phép quan sát mối quan hệ giữa các điểm dữ liệu ở nhiều cấp độ khác nhau.</p>
      <p>-  Có hai chiến lược chính:</p>
      <ul>
        <li>Bottom-up (Agglomerative): Bắt đầu với mỗi điểm dữ liệu là một cụm riêng lẻ. Ở mỗi bước, hai cụm gần nhau nhất được gộp lại. Quá trình lặp lại cho đến khi tất cả dữ liệu thuộc cùng một cụm lớn.</li>
        <li>Top-down (Divisive): Bắt đầu với một cụm chứa toàn bộ dữ liệu. Ở mỗi bước, cụm được tách dần ra thành các cụm nhỏ hơn dựa trên sự khác biệt.</li>
      </ul>
      <p>-  Việc lựa chọn cụm nào để gộp (hoặc tách) phụ thuộc vào phương pháp đo khoảng cách giữa các cụm, như:</p>
      <ul>
        <li>Single Linkage (liên kết đơn): khoảng cách giữa hai điểm gần nhất thuộc hai cụm.</li>
        <li>Complete Linkage (liên kết đầy đủ): khoảng cách giữa hai điểm xa nhất.</li>
        <li>Average Linkage: trung bình khoảng cách giữa các điểm của hai cụm.</li>
      </ul>
      <p>-  Sau khi xây dựng cây phân cấp, người dùng có thể "cắt cây" tại một mức nhất định để chia dữ liệu thành số cụm mong muốn</p>
      </div>
    
      <h5 class="mt-4" style="color:rgb(255, 0, 0);">1. Bottom-up (Agglomerative Clustering)</h5>
      <ul>
        <li><strong>Ý tưởng:</strong> Bắt đầu với mỗi điểm là một cụm riêng, sau đó gộp hai cụm gần nhau nhất dần dần cho đến khi chỉ còn một cụm duy nhất.</li>
        <li><strong>Toán học:</strong>
          <ul>
            <li>Dữ liệu: \\( X = \\{ x_1, x_2, ..., x_n \\},\\ x_i \\in \\mathbb{R}^d \\)</li>
            <li>Khoảng cách Euclid: \\( d(x_i, x_j) = \\sqrt{\\sum_{k=1}^{d}(x_{ik} - x_{jk})^2} \\)</li>
            <li>Liên kết cụm:
              <ul>
                <li>Single: \\( D(A,B) = \\min_{x \\in A, y \\in B} d(x,y) \\)</li>
                <li>Complete: \\( D(A,B) = \\max_{x \\in A, y \\in B} d(x,y) \\)</li>
                <li>Average: \\( D(A,B) = \\frac{1}{|A||B|} \\sum_{x \\in A} \\sum_{y \\in B} d(x,y) \\)</li>
                <li>Centroid: \\( D(A,B) = d(\\mu_A, \\mu_B),\\ \\mu_A = \\frac{1}{|A|} \\sum_{x \\in A} x \\)</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>

      <h5 class="mt-4" style="color:rgb(255, 0, 0);">2. Top-down (Divisive Clustering)</h5>
      <ul>
        <li><strong>Ý tưởng:</strong> Bắt đầu với toàn bộ dữ liệu là một cụm, sau đó chia dần thành các cụm con nhỏ hơn.</li>
        <li><strong>Toán học:</strong>
          <ul>
            <li>Dùng thuật toán phân chia như K-means hoặc PCA:</li>
            <li>
              K-means (chia 2 cụm): <br>
              \\( \\min \\sum_{x \\in C_1} \\|x - \\mu_1\\|^2 + \\sum_{x \\in C_2} \\|x - \\mu_2\\|^2 \\)
            </li>
            <li>
              PCA chia cụm: Dựa vào vector chính đầu tiên \\( v_1 \\), chia theo dấu của \\( (x - \\bar{x}) \\cdot v_1 \\)
            </li>
          </ul>
        </li>
      </ul>
    </div>
  `;

  const matrixHTML = runClusteringDetailedMatrix(trainRows, linkage);
  html += matrixHTML;  

  html += `
    <div class="section-title mt-4">4. Cây phân cấp từ dữ liệu train (${linkage})</div>
    <div class="canvas-wrapper mt-4">
      <canvas id="dendrogramCanvas"></canvas>
    </div>

    <div id="cutTreeSection" class="mt-4 p-3 border bg-light rounded">
      <label for="cutTreeK" class="form-label">Nhập số cụm cần cắt (K):</label>
      <input type="number" id="cutTreeK" class="form-control w-25" value="3" min="1">
      <button class="btn btn-success mt-2" id="predictTestBtn">Dự đoán cụm cho tập test</button>
    </div>

    <div class="cutTreeCanvasWrapper mt-4">
      <p style="color: blue; text-align: center; font-weight: bold; font-size: 18px;">
        Đồ thị cắt nhánh để tìm số cụm tối ưu cho giải thuật Hierarchical Clustering
      </p>
      <canvas id="dendrogramCutCanvas"></canvas>
    </div>

    <div id="testClusterResult"></div>
  `;

  document.getElementById("resultBox").innerHTML = html;

  // Đảm bảo vẽ sau khi gán DOM xong
  setTimeout(() => {
    // Vẽ cây ban đầu
    drawDendrogram(tree); // vẽ vào dendrogramCanvas
  
    // Sự kiện khi nhập số cụm K
    const cutTreeInput = document.getElementById("cutTreeK");
    cutTreeInput.addEventListener("input", function () {
      const K = parseInt(this.value);
      if (isNaN(K) || K < 1) return;

      // Thu thập độ cao của các lần gộp
      const mergeHeights = [];
      function collectHeights(node) {
        if (!node.left || !node.right) return;
        mergeHeights.push(node.height);
        collectHeights(node.left);
        collectHeights(node.right);
      }
      collectHeights(tree);

      mergeHeights.sort((a, b) => b - a); // giảm dần
      const cutHeight = mergeHeights[K - 1] || 0;

      // Vẽ cây đã cắt lên canvas mới
      drawDendrogram(tree, cutHeight, "dendrogramCutCanvas");
    });

    // ⚠️ Gọi ngay để vẽ cây cắt lần đầu
    cutTreeInput.dispatchEvent(new Event("input"));

  
    // Dự đoán cụm cho dữ liệu test
    document.getElementById("predictTestBtn").onclick = () => {
      const k = parseInt(document.getElementById("cutTreeK").value) || 3;
      const groups = cutTree(tree, k);
      const { labels, distanceMatrix, centroids } = predictTestClusters(testRows, trainRows, groups);
    
      let resultHTML = `<div class="section-title mt-4">4. Kết quả phân cụm dữ liệu test</div>`;
      resultHTML += `<table class="result-table table table-bordered text-center table-sm bg-light">
        <thead class="table-light"><tr><th>STT</th><th>Dữ liệu</th><th>Cụm</th></tr></thead><tbody>`;
      labels.forEach((c, i) => {
        resultHTML += `<tr><td>${i + 1}</td><td>${JSON.stringify(testRows[i])}</td><td>${c + 1}</td></tr>`;
      });
      resultHTML += `</tbody></table>`;
    
      // Bảng hiển thị khoảng cách đến các centroid
      resultHTML += `<h5 class="mt-4 text-primary text-center">Khoảng cách đến từng centroid</h5>`;
      resultHTML += `<table class="table table-bordered table-sm text-center"><thead><tr>
        <th>STT</th><th>Dữ liệu Test</th>`;
      for (let i = 0; i < groups.length; i++) {
        resultHTML += `<th>Centroid ${i + 1}</th>`;
      }
      resultHTML += `</tr></thead><tbody>`;
    
      testRows.forEach((row, i) => {
        resultHTML += `<tr><td>${i + 1}</td><td>${JSON.stringify(row)}</td>`;
        distanceMatrix[i].forEach((dist, j) => {
          resultHTML += `<td><a href="#" onclick="showDistanceToCentroid(${JSON.stringify(row)}, ${JSON.stringify(centroids[j])}, ${i}, ${j}); return false;">
            ${dist.toFixed(3)}</a></td>`;
        });
        resultHTML += `</tr>`;
      });
      resultHTML += `</tbody></table>`;
    
      // Hiển thị bảng centroid
      clusterGroupsGlobal = groups;
      trainRowsGlobal = trainRows;
      
      resultHTML += `<h5 class="mt-4 text-success text-center">Tọa độ các centroid</h5>`;
      resultHTML += `<table class="table table-bordered table-sm text-center"><thead><tr><th>Centroid</th>`;
      for (let i = 0; i < centroids[0].length; i++) {
        resultHTML += `<th>Chiều ${i + 1}</th>`;
      }
      resultHTML += `</tr></thead><tbody>`;
      centroids.forEach((centroid, idx) => {
        resultHTML += `<tr><td>Centroid ${idx + 1}</td>`;
        centroid.forEach((val, dim) => {
          resultHTML += `<td>
            <a href="#" onclick="event.preventDefault(); showCentroidDetail(${idx}, ${dim});">
              ${val.toFixed(3)}
            </a>
          </td>`;
        });
        resultHTML += `</tr>`;
      });
      resultHTML += `</tbody></table>`;      
          
      document.getElementById("testClusterResult").innerHTML = resultHTML;
    };
    
    
  }, 0);
  
  return html;

}

function drawDendrogram(root, cutHeight = null, canvasId = "dendrogramCanvas") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const leafNodes = [];
  function collectLeaves(node) {
    if (!node.left && !node.right) {
      leafNodes.push(node);
    } else {
      if (node.left) collectLeaves(node.left);
      if (node.right) collectLeaves(node.right);
    }
  }
  collectLeaves(root);

  const spacingX = 40;
  const paddingX = 50;
  const paddingY = 50;

  function getMaxHeight(node) {
    if (!node) return 0;
    return Math.max(node.height || 0, getMaxHeight(node.left), getMaxHeight(node.right));
  }
  const maxHeight = getMaxHeight(root);

  const wrapper = canvas.parentElement;
  const wrapperRect = wrapper.getBoundingClientRect();
  canvas.width = wrapperRect.width;
  canvas.height = wrapperRect.height;

  const availableHeight = canvas.height - paddingY * 2;
  const yScale = availableHeight / (maxHeight + 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1.5;
  ctx.font = "12px Arial";

  const leafX = {};
  leafNodes.forEach((node, i) => {
    leafX[node.id] = i * spacingX + paddingX;
  });

  function getX(node) {
    if (!node.left && !node.right) return leafX[node.id];
    return (getX(node.left) + getX(node.right)) / 2;
  }

  const clusterColors = {};
  const colorPalette = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000"
  ];
  leafNodes.forEach((node, index) => {
    clusterColors[node.id] = colorPalette[index % colorPalette.length];
  });

  function draw(node) {
    if (!node.left || !node.right) return;

    const y = canvas.height - paddingY - node.height * yScale;
    const yLeft = canvas.height - paddingY - node.left.height * yScale;
    const yRight = canvas.height - paddingY - node.right.height * yScale;
    const xLeft = getX(node.left);
    const xRight = getX(node.right);
    const xMid = (xLeft + xRight) / 2;

    const colorKey = node.left.id || node.right.id || node.id;
    const strokeColor = clusterColors[colorKey] || "#000";
    ctx.strokeStyle = strokeColor;

    ctx.beginPath();
    ctx.moveTo(xLeft, yLeft);
    ctx.lineTo(xLeft, y);
    ctx.lineTo(xMid, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(xRight, yRight);
    ctx.lineTo(xRight, y);
    ctx.lineTo(xMid, y);
    ctx.stroke();

    draw(node.left);
    draw(node.right);
  }

  draw(root);

  // Vẽ đường cắt nếu có
  if (cutHeight !== null) {
    const yCut = canvas.height - paddingY - cutHeight * yScale;
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, yCut);
    ctx.lineTo(canvas.width, yCut);
    ctx.stroke();
  }

  // Vẽ nhãn
  leafNodes.forEach((node) => {
    const x = leafX[node.id];
    const y = canvas.height - paddingY;
    ctx.fillStyle = clusterColors[node.id];
    ctx.beginPath();
    ctx.arc(x, y + 10, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.fillText(node.id, x - 5, y + 25);
  });
}

function runClusteringDetailedMatrix(trainRows, linkage = "single") {
  let html = "";
  let clusters = trainRows.map((_, i) => [i]);

  const euclidean = (a, b) =>
    Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));

  function clusterDistance(A, B) {
    let distances = [];
    for (let i of A) {
      for (let j of B) {
        distances.push(euclidean(trainRows[i], trainRows[j]));
      }
    }
    if (linkage === "single") return Math.min(...distances);
    if (linkage === "complete") return Math.max(...distances);
    return distances.reduce((a, b) => a + b, 0) / distances.length; // average
  }

  let step = 1;
  while (clusters.length > 1) {
    const n = clusters.length;
    const distMatrix = Array(n).fill(0).map(() => Array(n).fill("-"));
    let minDist = Infinity;
    let mergePair = [0, 1];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = clusterDistance(clusters[i], clusters[j]);
        distMatrix[i][j] = d.toFixed(3);
        distMatrix[j][i] = d.toFixed(3);

        if (d < minDist) {
          minDist = d;
          mergePair = [i, j];
        }
      }
    }

    html += `<h5 class="mt-4 text-danger">Bước ${step}: Bảng khoảng cách giữa các cụm</h5>`;
    html += `<table class="table table-bordered text-center table-sm"><thead><tr><th>#</th>`;
    for (let i = 0; i < n; i++) {
      html += `<th>${clusters[i].map(x => "x" + (x + 1)).join(", ")}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (let i = 0; i < n; i++) {
      html += `<tr><th>${clusters[i].map(x => "x" + (x + 1)).join(", ")}</th>`;
      for (let j = 0; j < n; j++) {
        if (i !== j && distMatrix[i][j] !== "-") {
          const aIdx = clusters[i][0];
          const bIdx = clusters[j][0];
          html += `<td>
            <a href="#" onclick="showDistanceDetail(${JSON.stringify(trainRows[aIdx])}, ${JSON.stringify(trainRows[bIdx])}, ${aIdx}, ${bIdx}); return false;">
              ${distMatrix[i][j]}
            </a>
          </td>`;
        } else {
          html += `<td>-</td>`;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;

    const [i, j] = mergePair;
    const newCluster = [...clusters[i], ...clusters[j]];
    html += `<p>Kết luận: Gộp cụm ${clusters[i].map(x => "x" + (x + 1)).join(", ")} và ${clusters[j].map(x => "x" + (x + 1)).join(", ")} thành <span style="color: red;">${newCluster.map(x => "x" + (x + 1)).join(", ")}</span>.</p><hr>`;

    clusters.splice(j, 1);
    clusters.splice(i, 1);
    clusters.push(newCluster);
    step++;
  }

  html += `<div id="formulaBox" class="mt-3"></div>`;
  return html;
}

function showDistanceDetail(pointA, pointB, idxA, idxB) {
  const modalBody = document.getElementById("modalFormulaContent");

  const squares = pointA.map((a, i) => {
    const b = pointB[i];
    const diff = a - b;
    return {
      diff,
      latex: `(${a} - ${b})^2 = ${diff}^2 = ${Math.pow(diff, 2)}`,
      value: Math.pow(diff, 2),
    };
  });

  const sum = squares.reduce((acc, s) => acc + s.value, 0);
  const sqrt = Math.sqrt(sum).toFixed(3);

  let latex = `
    \\[
    \\begin{aligned}
    &\\textbf{Tính khoảng cách Euclid giữa } x_{${idxA + 1}} \\text{ và } x_{${idxB + 1}}:\\\\[6pt]
    &d(x_{${idxA + 1}}, x_{${idxB + 1}}) = \\sqrt{\\sum_{k=1}^{d} (x_{ik} - x_{jk})^2} \\\\[10pt]
  `;

  squares.forEach((s, i) => {
    latex += `&(x_{${idxA + 1}${i + 1}} - x_{${idxB + 1}${i + 1}})^2 = ${s.latex} \\\\`;
  });

  latex += `&\\sum = ${squares.map(s => s.value).join(" + ")} = ${sum} \\\\`;
  latex += `&\\Rightarrow d = \\sqrt{${sum}} = ${sqrt}`;
  latex += `
    \\end{aligned}
    \\]
  `;

  modalBody.innerHTML = latex;
  if (window.MathJax) MathJax.typesetPromise();

  const modal = new bootstrap.Modal(document.getElementById('formulaModal'));
  modal.show();
}

function buildTestToClusterDistanceTable(testRows, trainRows, groups) {
  let html = `
    <div class="mt-4">
      <h5 class="text-primary">Chi tiết khoảng cách từ dữ liệu test đến từng cụm</h5>
      <table class="table table-bordered table-sm text-center">
        <thead class="table-light">
          <tr>
            <th>STT</th>
            <th>Dữ liệu Test</th>
            ${groups.map((_, i) => `<th>Cụm ${i + 1}</th>`).join("")}
            <th>Cụm gần nhất</th>
          </tr>
        </thead>
        <tbody>
  `;

  const euclidean = (a, b) =>
    Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));

  testRows.forEach((testPoint, idx) => {
    html += `<tr><td>${idx + 1}</td><td>${JSON.stringify(testPoint)}</td>`;

    const distances = groups.map((group) => {
      const distArr = group.map((i) => euclidean(testPoint, trainRows[i]));
      return Math.min(...distArr);
    });

    const minIndex = distances.indexOf(Math.min(...distances));

    distances.forEach((d) => {
      html += `<td>${d.toFixed(3)}</td>`;
    });

    html += `<td><strong style="color:green;">${minIndex + 1}</strong></td></tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}
function showDistanceToCentroid(testPoint, centroid, testIdx, centroidIdx) {
  const modalBody = document.getElementById("modalFormulaContent");

  const squares = testPoint.map((val, i) => {
    const diff = val - centroid[i];
    return {
      diff,
      latex: `(${val} - ${centroid[i]})^2 = ${diff.toFixed(3)}^2 = ${(diff ** 2).toFixed(3)}`,
      value: (diff ** 2)
    };
  });

  const sum = squares.reduce((acc, s) => acc + s.value, 0);
  const sqrt = Math.sqrt(sum).toFixed(3);

  let latex = `
  \\[
  \\begin{aligned}
  &\\textbf{Tính khoảng cách từ điểm test } x_{${testIdx + 1}} \\text{ đến centroid } C_{${centroidIdx + 1}}:\\\\[6pt]
  &d(x, C) = \\sqrt{\\sum_{i=1}^{d} (x_i - c_i)^2} \\\\[10pt]
  `;
  squares.forEach((s, i) => {
    latex += `&(x_{${i + 1}} - c_{${i + 1}})^2 = ${s.latex} \\\\`;
  });
  latex += `&\\sum = ${squares.map(s => s.value.toFixed(3)).join(" + ")} = ${sum.toFixed(3)} \\\\`;
  latex += `&\\Rightarrow d = \\sqrt{${sum.toFixed(3)}} = ${sqrt}`;
  latex += `
  \\end{aligned}
  \\]
  `;

  modalBody.innerHTML = latex;
  if (window.MathJax) MathJax.typesetPromise();

  const modal = new bootstrap.Modal(document.getElementById('formulaModal'));
  modal.show();
}
// Biến toàn cục để dùng lại
let clusterGroupsGlobal = [];
let trainRowsGlobal = [];
// 
function showCentroidDetail(centroidIndex, dimensionIndex) {
  const modalBody = document.getElementById("modalFormulaContent");

  const indices = clusterGroupsGlobal[centroidIndex]; // Chỉ số các điểm
  const points = indices.map(i => trainRowsGlobal[i]);
  const values = points.map(p => p[dimensionIndex]);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = (sum / values.length).toFixed(3);

  // Latex công thức chi tiết
  let latex = `
  \\[
  \\begin{aligned}
  &\\textbf{Tính trung bình chiều thứ ${dimensionIndex + 1} của Centroid ${centroidIndex + 1}}:\\\\[8pt]
  &\\text{Các điểm dữ liệu thuộc cụm: } ${indices.map(i => "x{" + (i) + "}").join(", ")} \\\\[10pt]
  `;

  indices.forEach((i, idx) => {
    latex += `&x{${i+1}} = ${trainRowsGlobal[i][dimensionIndex]} \\\\`;
  });

  latex += `
  \\\\[-2pt]
  &\\text{Tổng } = ${values.join(" + ")} = ${sum} \\\\
  &\\text{Số điểm } = ${values.length} \\\\
  &\\Rightarrow \\text{Trung bình } = \\frac{${sum}}{${values.length}} = ${avg}
  \\end{aligned}
  \\]
  `;

  modalBody.innerHTML = latex;
  if (window.MathJax) MathJax.typesetPromise();

  const modal = new bootstrap.Modal(document.getElementById('formulaModal'));
  modal.show();
}
