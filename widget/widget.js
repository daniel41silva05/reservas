// widget.js - Script embutível
(function () {
    // 1. Procurar o container da app
    const container = document.getElementById('reserva-widget');
    if (!container) return;

    // Obter dados do host
    const empresaId = container.getAttribute('data-empresa-id');
    const darkMode = container.getAttribute('data-theme') === 'dark';
    
    // Novas configurações de negócio
    const tipoNegocio = container.getAttribute('data-tipo') || 'hotel'; // 'hotel' ou 'servico'
    const horaCheckin = container.getAttribute('data-checkin') || '14:00';
    const horaCheckout = container.getAttribute('data-checkout') || '11:00';
    const duracaoServico = parseInt(container.getAttribute('data-duracao')) || 60; // minutos
    const recursoFixoId = container.getAttribute('data-recurso-id'); // Opcional

    // Supabase Credentials (neste cenário de SaaS o cliente embute o widget, mas usa as tuas credenciais public para aceder à tua DB limitadamente via RLS)
    const SUPABASE_URL = typeof window.ENV !== 'undefined' ? window.ENV.SUPABASE_URL : 'https://pvwuubqqkcpqswhravpa.supabase.co';
    const SUPABASE_ANON_KEY = typeof window.ENV !== 'undefined' ? window.ENV.SUPABASE_ANON_KEY : 'sb_publishable_vOPnCm5-b3HyhflNCWqg7w_HiVQihU6';

    // Como é um widget, precisamos da lib do supabase. Vamos injetá-la se não existir.
    if (typeof window.supabase === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = () => initWidget();
        document.head.appendChild(script);
    } else {
        initWidget();
    }

    // Descobrir a base URL do script atual para carregar o CSS do servidor correto (e não do cliente)
    let baseUrl = 'https://daniel41silva05.github.io/reservas/widget/';
    if (document.currentScript && document.currentScript.src) {
        baseUrl = document.currentScript.src.split('?')[0].replace('widget.js', '');
    }

    // Injetar CSS
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = baseUrl + 'widget.css';
    document.head.appendChild(styleLink);

    let supabase;
    let recursos = [];

    async function initWidget() {
        // Inicializa cliente supabase com o supabaseUrl logado no html
        // NOTA: Num cenário real precisamos da ANON_KEY. Vou ler do host se existir var, senão assume fallback.
        // O utilizador mencionou a PUBLISHABLE_KEY no supabase_rls_setup.sql:
        const url = typeof window.ENV !== 'undefined' ? window.ENV.SUPABASE_URL : SUPABASE_URL;
        const key = typeof window.ENV !== 'undefined' ? window.ENV.SUPABASE_ANON_KEY : SUPABASE_ANON_KEY;

        supabase = window.supabase.createClient(url, key);

        if (!empresaId) {
            container.innerHTML = '<div class="rz-alert error">Configuração Inválida: data-empresa-id em falta.</div>';
            return;
        }

        renderUI();
        await fetchRecursos();
    }

    function renderUI() {
        container.className = `rz-widget-container ${darkMode ? 'dark-mode' : ''}`;

        container.innerHTML = `
            <div class="rz-widget-header">
                <h3>Faça a sua Reserva</h3>
                <p>Verifique a disponibilidade e agende</p>
            </div>
            
            <div id="rz-alert" class="rz-alert"></div>

            <form id="rz-booking-form">
                <div class="rz-form-group" ${recursoFixoId ? 'style="display: none;"' : ''}>
                    <label>Escolha o Recurso/Serviço</label>
                    <select id="rz-recurso" class="rz-form-control" required disabled>
                        <option value="">A carregar...</option>
                    </select>
                </div>
                
                ${recursoFixoId ? `
                <div class="rz-form-group">
                    <label>Serviço/Recurso</label>
                    <input type="text" id="rz-recurso-nome-fixo" class="rz-form-control" disabled value="A carregar...">
                </div>
                ` : ''}

                ${tipoNegocio === 'hotel' ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="rz-form-group">
                        <label>Data Chegada (a partir das ${horaCheckin})</label>
                        <input type="date" id="rz-inicio-data" class="rz-form-control" required>
                    </div>
                    <div class="rz-form-group">
                        <label>Data Saída (até às ${horaCheckout})</label>
                        <input type="date" id="rz-fim-data" class="rz-form-control" required>
                    </div>
                </div>
                ` : `
                <div class="rz-form-group">
                    <label>Data e Hora do Serviço (Duração: ${duracaoServico} min)</label>
                    <input type="datetime-local" id="rz-inicio-datetime" class="rz-form-control" required>
                </div>
                `}
                
                <div id="rz-details" class="rz-details-box" style="display: none;">
                    <div style="font-size: 0.85rem; color: #666;">Resumo</div>
                    <div class="rz-price-calc">
                        <span>Total Estimado:</span>
                        <span id="rz-total-price">A Calcular...</span>
                    </div>
                </div>

                <div class="rz-form-group">
                    <label>Seu Nome</label>
                    <input type="text" id="rz-cliente-nome" class="rz-form-control" required placeholder="João Silva">
                </div>
                
                <div class="rz-form-group">
                    <label>Contacto (Tlm / Email)</label>
                    <input type="text" id="rz-cliente-contacto" class="rz-form-control" required placeholder="912345678">
                </div>

                <button type="submit" class="rz-btn" id="rz-submit-btn">Solicitar Reserva</button>
            </form>
        `;

        setupListeners();
    }

    async function fetchRecursos() {
        const select = document.getElementById('rz-recurso');
        // RLS Public permite select aos recursos ativos
        const { data, error } = await supabase
            .from('recursos')
            .select('id, nome')
            .eq('empresa_id', empresaId)
            .eq('ativo', true);

        if (error) {
            showAlert('Erro a carregar subserviços disponíveis.', 'error');
            select.innerHTML = '<option value="">Erro</option>';
            return;
        }

        recursos = data || [];

        if (recursos.length === 0) {
            select.innerHTML = '<option value="">Nenhum serviço disponível no momento.</option>';
            if (recursoFixoId) document.getElementById('rz-recurso-nome-fixo').value = "Indisponível";
        } else {
            select.innerHTML = '<option value="" disabled selected>Selecione uma opção...</option>' +
                recursos.map(r => `<option value="${r.id}">${r.nome}</option>`).join('');
                
            if (recursoFixoId) {
                select.value = recursoFixoId;
                const recFixo = recursos.find(r => r.id == recursoFixoId);
                if (recFixo) {
                    document.getElementById('rz-recurso-nome-fixo').value = recFixo.nome;
                } else {
                    document.getElementById('rz-recurso-nome-fixo').value = "Serviço não encontrado";
                }
            } else {
                select.disabled = false;
            }
        }
    }

    let currentPrice = 0;

    function setupListeners() {
        const form = document.getElementById('rz-booking-form');
        const selectRecurso = document.getElementById('rz-recurso');
        
        let inputInicioData = document.getElementById('rz-inicio-data');
        let inputFimData = document.getElementById('rz-fim-data');
        let inputInicioDatetime = document.getElementById('rz-inicio-datetime');

        // Função auxiliar para obter as datas de início e fim baseadas na configuração
        const getDates = () => {
            if (tipoNegocio === 'hotel') {
                if (!inputInicioData.value || !inputFimData.value) return null;
                // Combina data escolhida com hora fixa
                const start = new Date(`${inputInicioData.value}T${horaCheckin}`);
                const end = new Date(`${inputFimData.value}T${horaCheckout}`);
                return { start, end };
            } else {
                if (!inputInicioDatetime.value) return null;
                const start = new Date(inputInicioDatetime.value);
                const end = new Date(start.getTime() + duracaoServico * 60000); // adiciona minutos
                return { start, end };
            }
        };

        // Sempre que o utilizador altera datas ou recurso, tentamos verificar disponibilidade e preço
        const checkAvailabilityAndPrice = async () => {
            const recursoId = selectRecurso.value;
            const dates = getDates();

            if (!recursoId || !dates) return;

            const { start: inicio, end: fim } = dates;

            if (inicio >= fim) {
                showAlert(tipoNegocio === 'hotel' ? 'A data de saída tem de ser após a data de chegada.' : 'Data/hora inválida.', 'error');
                document.getElementById('rz-details').style.display = 'none';
                return;
            }

            hideAlert();

            // 1. Validar Bloqueios
            const blocked = await checkOverlaps('bloqueios_disponibilidade', recursoId, inicio.toISOString(), fim.toISOString());
            if (blocked) {
                showAlert('O recurso não está disponível nestas datas (Bloqueio do proprietário).', 'error');
                document.getElementById('rz-details').style.display = 'none';
                return;
            }

            // 2. Validar Reservas Existentes
            // Mesmo que públicas, só verificamos se há sobreposição sem ler dados sensiveis.
            const booked = await checkOverlaps('reservas', recursoId, inicio.toISOString(), fim.toISOString());
            if (booked) {
                showAlert('Já existe uma reserva que coincide com este horário. Tente outras datas.', 'error');
                document.getElementById('rz-details').style.display = 'none';
                return;
            }

            // 3. Calcular Preço (Simulando uma busca à tabela de preços na época correspondente)
            // Lógica base: buscar preco_base do primeiro dia
            const preco = await fetchPreco(recursoId, inicio.toISOString());

            // Simplificação MVP SaaS: O valor buscado * dias da reserva (se for recurso diário) ou horas. 
            // Vamos assumir "Dias" para turismo, ou valor fixo para tatuagens dependendo da empresa. 
            // Para ser versátil, vamos assumir que o "preco_base" da tabela `precos` é por dia ou bloco unitário.
            // Para simplificar vamos só ler o preco e assumir taxa flat baseada no recurso.

            // Calculo da dif em dias:
            const hours = Math.abs(fim - inicio) / 36e5;
            const days = Math.ceil(hours / 24);

            currentPrice = preco * Math.max(1, days);

            document.getElementById('rz-details').style.display = 'block';
            document.getElementById('rz-total-price').textContent = currentPrice.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        };

        selectRecurso.addEventListener('change', checkAvailabilityAndPrice);
        if (tipoNegocio === 'hotel') {
            inputInicioData.addEventListener('change', checkAvailabilityAndPrice);
            inputFimData.addEventListener('change', checkAvailabilityAndPrice);
        } else {
            inputInicioDatetime.addEventListener('change', checkAvailabilityAndPrice);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const recursoId = selectRecurso.value;
            const dates = getDates();
            
            if (!dates) {
                showAlert('Por favor, preencha as datas.', 'error'); return;
            }
            
            const tInicio = dates.start.toISOString();
            const tFim = dates.end.toISOString();
            const nome = document.getElementById('rz-cliente-nome').value;
            const contacto = document.getElementById('rz-cliente-contacto').value;

            // Double check
            if (dates.start >= dates.end) {
                showAlert('Datas inválidas.', 'error'); return;
            }

            const btn = document.getElementById('rz-submit-btn');
            btn.innerHTML = 'A processar...';
            btn.disabled = true;

            const payload = {
                empresa_id: empresaId,
                recurso_id: recursoId,
                data_hora_inicio: tInicio,
                data_hora_fim: tFim,
                preco_final: currentPrice || 0,
                status: 'pendente',
                cliente_nome: nome,
                cliente_contacto: contacto
            };

            const { error } = await supabase.from('reservas').insert([payload]);

            if (error) {
                showAlert('Houve um erro ao processar a reserva: ' + error.message, 'error');
                btn.innerHTML = 'Solicitar Reserva';
                btn.disabled = false;
            } else {
                form.innerHTML = `
                    <div style="text-align: center; padding: 40px 0;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <h3 style="margin-bottom: 8px;">Pedido Recebido!</h3>
                        <p style="color:#666;">A sua marcação está pendente de confirmação. Entraremos em contacto consigo em breve.</p>
                    </div>
                `;
            }
        });
    }

    async function checkOverlaps(table, recursoId, startIso, endIso) {
        // Como fazer o check temporal em sb_publishable client side com RLS público?
        // Sobreposição: (start A < end B) e (end A > start B)
        // Não é possível fazer OR clauses muito puras de forma simples no JS SDK, então podemos filtrar os registos do recurso e no JS ver se choca.
        // Já que é RLS público e estamos pelo browser, puxamos por recursoId e datas > Today
        const today = new Date().toISOString();
        const { data, error } = await supabase
            .from(table)
            .select('data_hora_inicio, data_hora_fim')
            .eq('recurso_id', recursoId)
            .gte('data_hora_fim', today);

        if (error || !data) return false;

        const start = new Date(startIso);
        const end = new Date(endIso);

        for (let idx = 0; idx < data.length; idx++) {
            const rowStart = new Date(data[idx].data_hora_inicio);
            const rowEnd = new Date(data[idx].data_hora_fim);

            if (start < rowEnd && end > rowStart) {
                return true; // Há Colisão temporal!
            }
        }

        return false;
    }

    async function fetchPreco(recursoId, startIso) {
        // Tenta obter o preço se houver uma época definida que englobe
        const searchDate = startIso.split('T')[0]; // Só 'YYYY-MM-DD'

        const { data, error } = await supabase
            .from('precos')
            .select('preco_base')
            .eq('recurso_id', recursoId)
            .lte('data_inicio', searchDate)
            .gte('data_fim', searchDate)
            .limit(1);

        if (error || !data || data.length === 0) {
            return 0; // Preço default ou sob-consulta se não houver época configurada
        }

        return parseFloat(data[0].preco_base);
    }

    function showAlert(msg, type) {
        const el = document.getElementById('rz-alert');
        el.className = `rz-alert ${type}`;
        el.textContent = msg;
    }

    function hideAlert() {
        const el = document.getElementById('rz-alert');
        el.className = 'rz-alert';
    }

})();
