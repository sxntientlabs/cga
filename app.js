// CGAbrillian - Application Logic

// 1. Initialize Examination Date
document.getElementById('exam-date').valueAsDate = new Date();

// 2. Accordion Logic
function toggleSection(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('active');
}

// 3. Selection Logic
function selectOption(btn, value) {
    const group = btn.closest('.question-group');
    const optionsDiv = btn.parentElement;
    Array.from(optionsDiv.children).forEach(child => child.classList.remove('selected'));
    btn.classList.add('selected');
    group.dataset.value = value;
    
    // Auto-fill logic for CFS
    const section = btn.closest('.section-content');
    if (section.id === 'cfs-section' && value > 0) {
        // If "Ya" is selected, auto-select "Tidak" for subsequent questions
        const groups = Array.from(section.querySelectorAll('.question-group'));
        const currentIndex = groups.indexOf(group);
        for (let i = currentIndex + 1; i < groups.length; i++) {
            const nextGroup = groups[i];
            const tidakBtn = Array.from(nextGroup.querySelectorAll('.option-btn')).find(b => b.textContent === 'Tidak');
            if (tidakBtn) {
                Array.from(tidakBtn.parentElement.children).forEach(child => child.classList.remove('selected'));
                tidakBtn.classList.add('selected');
                nextGroup.dataset.value = 0;
            }
        }
    }
    
    updateSectionStatus(section);
}

function updateSectionStatus(section) {
    const sectionId = section.id;
    const groups = section.querySelectorAll('.question-group');
    const filledGroups = Array.from(groups).filter(g => g.querySelector('.selected'));
    const statusLabelId = sectionId.split('-')[0] + '-status';
    const statusLabel = document.getElementById(statusLabelId);
    
    if (statusLabel) {
        if (filledGroups.length === groups.length) {
            statusLabel.textContent = 'Lengkap';
            statusLabel.style.color = '#fff';
        } else {
            statusLabel.textContent = 'Belum lengkap';
            statusLabel.style.color = 'rgba(255,255,255,0.7)';
        }
    }
}

// 4. Assessment Data
const assessments = {
    'isar': {
        container: 'isar-section',
        questions: [
            { text: 'Butuh bantuan rutin dari orang lain?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Lebih banyak butuh bantuan merawat diri?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Pernah dirawat inap dalam 6 bulan terakhir?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Dapat melihat dengan baik?', options: [{t:'Tidak', v:1}, {t:'Ya', v:0}] },
            { text: 'Masalah serius dengan daya ingat?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Konsumsi > 3 macam obat setiap hari?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] }
        ]
    },
    'adl': {
        container: 'adl-section',
        questions: [
            { text: 'Makan', options: [{t:'Bantuan penuh', v:0}, {t:'Perlu bantuan (potong lauk/oles)', v:1}, {t:'Mandiri', v:2}] },
            { text: 'Mandi', options: [{t:'Butuh bantuan', v:0}, {t:'Mandiri', v:1}] },
            { text: 'Perawatan diri', options: [{t:'Butuh bantuan', v:0}, {t:'Mandiri (cuci muka, sisir, dll)', v:1}] },
            { text: 'Berpakaian', options: [{t:'Bantuan penuh', v:0}, {t:'Sebagian dibantu', v:1}, {t:'Mandiri', v:2}] },
            { text: 'Buang Air Besar (BAB)', options: [{t:'Inkontinen', v:0}, {t:'Kadang inkontinen', v:1}, {t:'Kontinen', v:2}] },
            { text: 'Buang Air Kecil (BAK)', options: [{t:'Inkontinen', v:0}, {t:'Kadang inkontinen', v:1}, {t:'Kontinen', v:2}] },
            { text: 'Penggunaan Toilet', options: [{t:'Bantuan penuh', v:0}, {t:'Perlu bantuan', v:1}, {t:'Mandiri', v:2}] },
            { text: 'Transfer (pindah tempat tidur ke kursi)', options: [{t:'Tidak mampu', v:0}, {t:'Banyak bantuan (2 orang)', v:1}, {t:'Sedikit bantuan (1 orang)', v:2}, {t:'Mandiri', v:3}] },
            { text: 'Mobilitas (berjalan di permukaan datar)', options: [{t:'Tidak mampu', v:0}, {t:'Bisa dengan kursi roda', v:1}, {t:'Mandiri dengan alat bantu', v:2}, {t:'Mandiri', v:3}] },
            { text: 'Naik Turun Tangga', options: [{t:'Tidak mampu', v:0}, {t:'Perlu bantuan', v:1}, {t:'Mandiri', v:2}] }
        ]
    },
    'iadl': {
        container: 'iadl-section',
        questions: [
            { text: 'Penggunaan telepon', options: [{t:'Menghubungi & mencari nomor', v:1}, {t:'Menjawab saja', v:1}, {t:'Tidak bisa', v:0}] },
            { text: 'Kemampuan pergi ke tempat', options: [{t:'Mandiri bepergian', v:1}, {t:'Mengatur sendiri perjalanan', v:1}, {t:'Hanya jika disertai', v:1}, {t:'Tidak bepergian sama sekali', v:0}] },
            { text: 'Kemampuan berbelanja', options: [{t:'Mandiri belanja semua kebutuhan', v:1}, {t:'Perlu bantuan antar belanja', v:0}, {t:'Tidak mampu belanja', v:0}] },
            { text: 'Menyiapkan makanan', options: [{t:'Mandiri rencana & masak', v:1}, {t:'Menyiapkan bila bahan tersedia', v:0}, {t:'Perlu disiapkan & dilayani', v:0}] },
            { text: 'Pekerjaan rumah', options: [{t:'Mandiri (pekerjaan berat)', v:1}, {t:'Mandiri (pekerjaan ringan)', v:1}, {t:'Perlu bantuan', v:1}, {t:'Tidak ikut merawat rumah', v:0}] },
            { text: 'Mencuci pakaian', options: [{t:'Mandiri mencuci semua pakaian', v:1}, {t:'Mencuci pakaian kecil', v:1}, {t:'Semua dicuci orang lain', v:0}] },
            { text: 'Mengatur obat', options: [{t:'Mandiri dosis & waktu', v:1}, {t:'Tidak mampu siapkan sendiri', v:0}] },
            { text: 'Mengatur keuangan', options: [{t:'Mandiri atur semua keuangan', v:1}, {t:'Perlu bantuan untuk transaksi penting', v:1}, {t:'Tidak mampu putuskan atau pegang uang', v:0}] }
        ]
    },
    'amt': {
        container: 'amt-section',
        questions: [
            { text: 'Umur Anda?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Waktu / Jam sekarang?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Alamat tempat tinggal?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Tahun sekarang?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Tempat sekarang (RS/Rumah)?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Kenal 2 orang (dokter/perawat/keluarga)?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Tanggal lahir Anda?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Tahun kemerdekaan RI?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Nama Presiden RI?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] },
            { text: 'Menghitung mundur 20 sampai 1?', options: [{t:'Benar', v:1}, {t:'Salah', v:0}] }
        ]
    },
    'gds': {
        container: 'gds-section',
        questions: [
            { text: 'Apakah Anda sebenarnya puas dengan kehidupan Anda?', options: [{t:'Ya', v:0}, {t:'Tidak', v:1}] },
            { text: 'Apakah Anda merasa bosan?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Apakah Anda sering merasa tidak berdaya?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Apakah Anda lebih senang tinggal di rumah?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Apakah Anda merasa tidak berharga?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] }
        ]
    },
    'mna': {
        container: 'mna-section',
        questions: [
            { text: 'Asupan makanan berkurang dalam 3 bulan terakhir?', options: [{t:'Asupan makanan sangat berkurang', v:0}, {t:'Asupan makanan agak berkurang', v:1}, {t:'Asupan makanan tidak berkurang', v:2}] },
            { text: 'Berat badan turun dalam 3 bulan terakhir?', options: [{t:'Penurunan berat badan > 3kg', v:0}, {t:'Tidak tahu', v:1}, {t:'Penurunan berat badan 1-3kg', v:2}, {t:'Berat badan tidak turun', v:3}] },
            { text: 'Mobilitas?', options: [{t:'Hanya di tempat tidur/kursi roda', v:0}, {t:'Dapat bangkit tapi tidak keluar rumah', v:1}, {t:'Dapat bepergian ke luar rumah', v:2}] },
            { text: 'Stres psikologis/penyakit akut dalam 3 bulan terakhir?', options: [{t:'Ya', v:0}, {t:'Tidak', v:2}] },
            { text: 'Masalah neuropsikologis?', options: [{t:'Demensia berat atau depresi berat', v:0}, {t:'Demensia ringan', v:1}, {t:'Tidak ada gangguan psikologis', v:2}] },
            { text: 'Indeks Massa Tubuh (IMT)?', options: [{t:'IMT < 19', v:0}, {t:'IMT 19 - < 21', v:1}, {t:'IMT 21 - < 23', v:2}, {t:'IMT 23 atau lebih besar', v:3}] }
        ]
    },
    'frail': {
        container: 'frail-section',
        questions: [
            { text: 'Fatigue (Kelelahan)', options: [{t:'Sepanjang waktu', v:1}, {t:'Sebagian besar waktu', v:1}, {t:'Kadang-kadang', v:0}, {t:'Jarang', v:0}] },
            { text: 'Resistance (Resistensi): Naik 10 anak tangga?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Ambulation (Ambulasi): Berjalan 100-200 meter?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Illness (Penyakit): > 5 dari 11 penyakit utama?', options: [{t:'5-11 penyakit', v:1}, {t:'0-4 penyakit', v:0}] },
            { text: 'Loss of Weight: Penurunan BB > 5% dalam 6 bulan?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] }
        ]
    },
    'cfs': {
        container: 'cfs-section',
        questions: [
            { text: 'Apakah lansia tersebut menderita penyakit terminal dengan harapan hidup < 6 bulan?', options: [{t:'Ya', v:9}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut menderita ketergantungan total dan mendekati akhir hayat?', options: [{t:'Ya', v:8}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut menderita ketergantungan total untuk perawatan diri (tidak mendekati akhir hayat)?', options: [{t:'Ya', v:7}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut membutuhkan bantuan untuk aktivitas luar, merawat rumah dan/atau mandi?', options: [{t:'Ya', v:6}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut membutuhkan bantuan IADL (menggunakan telepon, berbelanja, menyiapkan makanan, urusan rumah tangga, mencuci pakaian, penggunaan transportasi)?', options: [{t:'Ya', v:5}, {t:'Tidak', v:0}] },
            { text: 'Walau lansia tidak bergantung pada orang lain, apakah gejala-gejala yang dialami lansia ini membatasi aktivitasnya?', options: [{t:'Ya', v:4}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut memiliki masalah medis yang terkendali dengan baik, namun tidak aktif secara teratur selain berjalan kaki?', options: [{t:'Ya', v:3}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut tidak mengalami gejala penyakit aktif, dan hanya latihan olahraga sesekali?', options: [{t:'Ya', v:2}, {t:'Tidak', v:0}] },
            { text: 'Apakah lansia tersebut latihan olahraga teratur dan paling bugar di kelompok usianya?', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] }
        ]
    },
    'sar': {
        container: 'sar-section',
        questions: [
            { text: 'Kekuatan (Strength): Membawa beban 5 kg?', options: [{t:'Sangat sulit', v:2}, {t:'Beberapa kesulitan', v:1}, {t:'Tidak ada kesulitan', v:0}] },
            { text: 'Bantuan Berjalan?', options: [{t:'Sangat sulit/pakai alat bantu/tidak bisa', v:2}, {t:'Beberapa kesulitan', v:1}, {t:'Tidak ada kesulitan', v:0}] },
            { text: 'Bangkit dari Kursi?', options: [{t:'Sangat sulit/tidak bisa tanpa bantuan', v:2}, {t:'Beberapa kesulitan', v:1}, {t:'Tidak ada kesulitan', v:0}] },
            { text: 'Menaiki Tangga?', options: [{t:'Sangat sulit/tidak bisa', v:2}, {t:'Beberapa kesulitan', v:1}, {t:'Tidak ada kesulitan', v:0}] },
            { text: 'Jatuh (1 tahun terakhir)?', options: [{t:'4 kali atau lebih', v:2}, {t:'1-3 kali jatuh', v:1}, {t:'Tidak pernah', v:0}] }
        ]
    },
    'jatuh': {
        container: 'jatuh-section',
        questions: [
            { text: 'Kebingungan, Disorientasi, Impulsivitas', options: [{t:'Ya', v:4}, {t:'Tidak', v:0}] },
            { text: 'Depresi Simtomatik', options: [{t:'Ya', v:2}, {t:'Tidak', v:0}] },
            { text: 'Perubahan Eliminasi (Mandiri ke Kamar Mandi)', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Pusing / Vertigo', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Jenis Kelamin (Laki-laki)', options: [{t:'Laki-laki', v:1}, {t:'Perempuan', v:0}] },
            { text: 'Pemberian Antiepilepsi', options: [{t:'Ya', v:2}, {t:'Tidak', v:0}] },
            { text: 'Pemberian Benzodiazepine', options: [{t:'Ya', v:1}, {t:'Tidak', v:0}] },
            { text: 'Get-Up-and-Go Test', options: [{t:'Mandiri (bisa bangkit sekali coba)', v:0}, {t:'Perlu bantuan/dorongan', v:1}, {t:'Sangat sulit/tidak bisa tanpa bantuan', v:3}, {t:'Hanya duduk di tepi tempat tidur', v:4}] }
        ]
    },
    'braden': {
        container: 'braden-section',
        questions: [
            { text: 'Sensory Perception', options: [{t:'Completely Limited', v:1}, {t:'Very Limited', v:2}, {t:'Slightly Limited', v:3}, {t:'No Impairment', v:4}] },
            { text: 'Moisture', options: [{t:'Constantly Moist', v:1}, {t:'Very Moist', v:2}, {t:'Occasionally Moist', v:3}, {t:'Rarely Moist', v:4}] },
            { text: 'Activity', options: [{t:'Bedfast', v:1}, {t:'Chairfast', v:2}, {t:'Walks Occasionally', v:3}, {t:'Walks Frequently', v:4}] },
            { text: 'Mobility', options: [{t:'Completely Immobile', v:1}, {t:'Very Limited', v:2}, {t:'Slightly Limited', v:3}, {t:'No Limitation', v:4}] },
            { text: 'Nutrition', options: [{t:'Very Poor', v:1}, {t:'Probably Inadequate', v:2}, {t:'Adequate', v:3}, {t:'Excellent', v:4}] },
            { text: 'Friction and Shear', options: [{t:'Problem', v:1}, {t:'Potential Problem', v:2}, {t:'No Apparent Problem', v:3}] }
        ]
    }
};

function renderAssessments() {
    for (const [id, data] of Object.entries(assessments)) {
        const container = document.getElementById(data.container);
        if (!container) continue;
        
        container.innerHTML = '';
        data.questions.forEach((q, idx) => {
            const group = document.createElement('div');
            group.className = 'question-group';
            group.dataset.id = `${id}-${idx}`;
            
            const qText = document.createElement('div');
            qText.className = 'question-text';
            qText.textContent = q.text;
            
            const optionsDiv = document.createElement('div');
            optionsDiv.className = q.options.length > 2 ? 'options-stack' : 'options-grid';
            
            q.options.forEach(opt => {
                const btn = document.createElement('div');
                btn.className = 'option-btn';
                btn.textContent = opt.t;
                btn.onclick = () => selectOption(btn, opt.v);
                optionsDiv.appendChild(btn);
            });
            
            group.appendChild(qText);
            group.appendChild(optionsDiv);
            container.appendChild(group);
        });
    }
}

function calculateScores() {
    let output = `CGA ${document.getElementById('exam-date').value}\n`;
    
    const getScore = (prefix) => {
        const btns = document.querySelectorAll(`[data-id^="${prefix}"] .selected`);
        const groups = document.querySelectorAll(`[id^="${prefix}-section"] .question-group`);
        if (btns.length === groups.length && groups.length > 0) {
            return Array.from(btns).reduce((sum, btn) => sum + parseInt(btn.parentElement.dataset.value), 0);
        }
        return null;
    };

    const isar = getScore('isar');
    if (isar !== null) output += `ISAR: ${isar}/6 (${isar >= 2 ? 'Risiko tinggi' : 'Risiko rendah'})\n`;

    const adl = getScore('adl');
    if (adl !== null) {
        let interp = 'Ketergantungan Total';
        if (adl >= 20) interp = 'Mandiri';
        else if (adl >= 12) interp = 'Ringan';
        else if (adl >= 9) interp = 'Sedang';
        else if (adl >= 5) interp = 'Berat';
        output += `ADL Barthel: ${adl} (${interp})\n`;
    }

    const iadl = getScore('iadl');
    if (iadl !== null) output += `IADL Lawton: ${iadl}/8\n`;

    const amt = getScore('amt');
    if (amt !== null) output += `Status Mental (AMT): ${amt}/10 (${amt <= 7 ? 'Gangguan kognitif' : 'Normal'})\n`;

    const gds = getScore('gds');
    if (gds !== null) output += `Status Mental (GDS-5): ${gds}/5 (${gds >= 2 ? 'Suspek depresi' : 'Normal'})\n`;

    const mna = getScore('mna');
    if (mna !== null) {
        let interp = 'Malnutrisi';
        if (mna >= 12) interp = 'Status gizi normal';
        else if (mna >= 8) interp = 'Berisiko malnutrisi';
        output += `Nutrition (MNA SF): ${mna}/14 (${interp})\n`;
    }

    const frail = getScore('frail');
    if (frail !== null) {
        let interp = 'Frail';
        if (frail === 0) interp = 'Robust/Fit/Sehat';
        else if (frail <= 2) interp = 'Pre-frail';
        else if (frail >= 3) interp = 'Frail (Rentan)';
        output += `Frailty (FRAIL): ${frail}/5 (${interp})\n`;
    }

    const cfsBtns = document.querySelectorAll(`[data-id^="cfs-"] .selected`);
    if (cfsBtns.length === 9) {
        const cfsValues = Array.from(cfsBtns).map(btn => parseInt(btn.parentElement.dataset.value));
        const cfs = Math.max(...cfsValues);
        if (cfs > 0) {
            const labels = ['Sangat Fit', 'Fit', 'Well', 'Vulnerable', 'Mildly Frail', 'Moderately Frail', 'Severely Frail', 'Very Severely Frail', 'Terminally Ill'];
            output += `Frailty (CFS): ${cfs} (${labels[cfs-1]})\n`;
        } else {
            output += `Frailty (CFS): Inkonsisten (Pilih 'Ya' pada kategori yang paling sesuai)\n`;
        }
    }

    const sar = getScore('sar');
    if (sar !== null) output += `Sarcopenia (SARC-F): ${sar}/10 (${sar >= 4 ? 'Risiko sarcopenia' : 'Tidak berisiko'})\n`;

    const jatuh = getScore('jatuh');
    if (jatuh !== null) output += `Falls Risk (Hendrich II): ${jatuh} (${jatuh >= 5 ? 'Risiko tinggi' : 'Risiko rendah'})\n`;

    const braden = getScore('braden');
    if (braden !== null) {
        let interp = 'Tidak ada risiko';
        if (braden <= 9) interp = 'Risiko sangat tinggi';
        else if (braden <= 12) interp = 'Risiko tinggi';
        else if (braden <= 14) interp = 'Risiko sedang';
        else if (braden <= 18) interp = 'Risiko ringan';
        output += `Braden Scale: ${braden} (${interp})\n`;
    }

    document.getElementById('results').textContent = output;
}

function resetForm() {
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.status-label').forEach(lbl => lbl.textContent = 'Belum lengkap');
    document.getElementById('results').textContent = 'Hasil akan muncul di sini...';
}

function copyResults() {
    const text = document.getElementById('results').textContent;
    if (text.includes('Hasil akan muncul')) {
        alert('Hitung skor terlebih dahulu!');
        return;
    }
    navigator.clipboard.writeText(text).then(() => alert('Hasil disalin ke clipboard!'));
}

renderAssessments();
