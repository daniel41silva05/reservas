// widget.js - Script embutível
(function () {
    const container = document.getElementById('reserva-widget');
    if (!container) return;

    const empresaId = container.getAttribute('data-empresa-id');
    const darkMode = container.getAttribute('data-theme') === 'dark';
    const tipoNegocio = container.getAttribute('data-tipo') || 'hotel';
    const recursoFixoId = container.getAttribute('data-recurso-id') || '';
    const color = container.getAttribute('data-color') || '#3b82f6';
    const checkin = container.getAttribute('data-checkin') || '';
    const checkout = container.getAttribute('data-checkout') || '';
    const duracao = container.getAttribute('data-duracao') || '';
    const bgColor = container.getAttribute('data-bg-color') || '';

    if (!empresaId) {
        container.innerHTML = '<div style="color:red; padding: 10px; font-family: sans-serif;">Erro: data-empresa-id em falta no widget.</div>';
        return;
    }

    let baseUrl = 'https://daniel41silva05.github.io/reservas/';
    if (document.currentScript && document.currentScript.src) {
        baseUrl = document.currentScript.src.split('?')[0].replace('widget/widget.js', '');
    }

    const qs = new URLSearchParams({
        empresa: empresaId,
        tipo: tipoNegocio,
        theme: darkMode ? 'dark' : 'light',
        color: color,
        recurso: recursoFixoId,
        checkin: checkin,
        checkout: checkout,
        duracao: duracao,
        bgcolor: bgColor
    });

    const iframe = document.createElement('iframe');
    iframe.src = `${baseUrl}widget/iframe.html?${qs.toString()}`;
    iframe.style.width = '1px';
    iframe.style.minWidth = '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.height = '650px'; // Altura inicial conservadora
    iframe.style.border = 'none';
    iframe.style.borderRadius = '16px';
    iframe.style.background = 'transparent';
    iframe.title = 'Reserva Widget';
    
    container.innerHTML = '';
    container.appendChild(iframe);

    // Auto-resize listener para adaptar a altura do iframe ao conteúdo interno
    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'resize' && e.data.height) {
            iframe.style.height = (e.data.height) + 'px';
        }
    });
})();
