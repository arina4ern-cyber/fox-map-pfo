// Инициализация карты
const map = new maplibregl.Map({
  container: 'map',
  style: "https://raw.githubusercontent.com/gtitov/basemaps/refs/heads/master/positron-nolabels.json",
  center: [50, 54], // Центр Приволжского ФО
  zoom: 5
});

map.on('load', () => {
    // 1. Подключаем ваш файл с данными
    map.addSource('pfo-data', {
        type: 'geojson',
        data: './data/fox_pfo.geojson' 
    });

    // 2. Слой заливки (градиент от желтого к темно-бордовому)
    map.addLayer({
        id: 'pfo-fox-layer',
        type: 'fill',
        source: 'pfo-data',
        paint: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['to-number', ['get', 'fox'], 0], // Преобразуем строку в число
                1, '#ffeda0',   // 1 тыс. - светло-желтый
                3, '#feb24c',   // 3 тыс. - оранжевый
                5, '#f03b20',   // 5 тыс. - красный
                7, '#800026'    // 7 тыс. и выше - темно-бордовый
            ],
            'fill-opacity': 0.7
        }
    });

    // 3. Слой границ
    map.addLayer({
        id: 'pfo-borders',
        type: 'line',
        source: 'pfo-data',
        paint: {
            'line-color': '#555',
            'line-width': 1.5
        }
    });

    // 4. Слой подписей (названия регионов)
    map.addLayer({
        id: 'pfo-labels',
        type: 'symbol',
        source: 'pfo-data',
        layout: {
            'text-field': ['get', 'name:ru'], // Берем русское название
            'text-size': 12,
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-allow-overlap': false,
            'text-ignore-placement': false
        },
        paint: {
            'text-color': '#000',
            'text-halo-color': '#fff',
            'text-halo-width': 2 // Белая обводка для читаемости
        }
    });

    // ВАЖНО: Вместо map.fitBounds используем jumpTo, чтобы избежать ошибки
    map.jumpTo({
        center: [50, 54], 
        zoom: 5          
    });

    // 5. Всплывающее окно при клике на регион
    map.on('click', 'pfo-fox-layer', (e) => {
        const props = e.features[0].properties;
        const regionName = props['name:ru'] || props.name || 'Регион';
        const foxCount = props.fox !== undefined ? props.fox : 'нет данных';

        const html = `
            <h3>${regionName}</h3>
            <p style="font-size: 16px;">🦊 <b>Лисица:</b> ${foxCount} тыс. особей</p>
        `;
        
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map);
    });

    // 6. Курсор при наведении на регион
    map.on('mouseenter', 'pfo-fox-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'pfo-fox-layer', () => { map.getCanvas().style.cursor = ''; });


    // ==========================================
    // 7. ПОСТРОЕНИЕ КРУГОВОЙ ДИАГРАММЫ (Chart.js)
    // ==========================================
    
    // Загружаем данные еще раз специально для диаграммы
    fetch('./data/fox_pfo.geojson')
        .then(response => response.json())
        .then(data => {
            let chartLabels = [];
            let chartData = [];
            let totalFox = 0;

            // Пробегаемся по всем регионам и собираем цифры
            data.features.forEach(feature => {
                const regionName = feature.properties['name:ru'] || feature.properties.name || 'Регион';
                const foxCount = parseFloat(feature.properties.fox) || 0; 
                
                if (foxCount > 0) {
                    totalFox += foxCount;
                    chartLabels.push(regionName);
                    chartData.push(foxCount);
                }
            });

            // Палитра цветов для секторов
            const colorPalette = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225', '#E67E22', '#8E44AD', '#2980B9', '#27AE60', '#D35400', '#8E44AD'];
            const chartColors = chartLabels.map((_, i) => colorPalette[i % colorPalette.length]);

            // Находим canvas на странице и рисуем
            const ctx = document.getElementById('foxChart').getContext('2d');
            new Chart(ctx, {
                type: 'doughnut', // Кольцевая диаграмма
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: chartColors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // Прячем легенду, чтобы не занимала место
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    // Считаем процент от общей суммы
                                    const percentage = ((value / totalFox) * 100).toFixed(1);
                                    // Выводим: "Регион: 5.97 тыс. (10.9%)"
                                    return `${label}: ${value} тыс. (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        })
        .catch(error => console.error('Ошибка при загрузке данных для диаграммы:', error));
});