// --- SUA LÓGICA DE DADOS ORIGINAL (INTACTA) ---
async function initGrafo() {
    let materias;
    let nodes = [];
    let edges = [];
    
    // Seu fetch original
    await fetch("/grade2015.json").then((response) => {
        if (!response.ok)
            throw new Error("Erro no JSON.")
        return response.json()
    }).then((data) => {
        materias = data;
    }).catch(error => console.error("Erro ocorrido no armazenamento do JSON: " + error));

    // Seu loop original (0 a 9)
    for (let i = 0; i < 9; i++) {
        // Verificação de segurança caso o JSON não tenha algum período
        if(materias[(i + 1) + "º Período"]) {
            materias[(i + 1) + "º Período"].forEach(m => {
                nodes.push({
                    data: {
                        id: m.codigo,
                        label: m.disciplina,
                        periodo: `${i + 1}`,
                        // Apenas adicionei isso para ajudar na ordenação visual depois
                        pre_requisitos_lista: m.pre_requisitos || [] 
                    }
                })
                
                if (m.pre_requisitos != []) {
                    m.pre_requisitos.forEach(pre => {
                        // Sua lógica original de arestas (Matéria -> Pré-requisito)
                        edges.push({
                            data: {
                                id: `${m.codigo}->${pre}`,
                                source: m.codigo,
                                target: pre
                            }
                        })
                    })
                }
            });
        }
    }
    montarCytoscape(nodes, edges);
}

initGrafo();

// --- AQUI COMEÇA A MODIFICAÇÃO VISUAL (LAYOUT + SIDEBAR) ---
function montarCytoscape(nodes, edges) {

    // 1. CÁLCULO DE POSIÇÕES (Para garantir que caiba na tela e fique organizado)
    // Isso roda ANTES de desenhar o grafo
    const byPeriod = {};
    const yPositions = {}; // Auxiliar para alinhar alturas

    nodes.forEach(n => {
        const p = parseInt(n.data.periodo);
        if (!byPeriod[p]) byPeriod[p] = [];
        byPeriod[p].push(n);
    });

    // Configuração da Grade Virtual (Responsividade)
    const X_SPACING = 300; 
    const Y_SPACING = 90; 

    // Itera período por período calculando X e Y
    Object.keys(byPeriod).sort((a,b) => a-b).forEach((p, colIndex) => {
        const materiasDoPeriodo = byPeriod[p];
        
        // Ordenação Visual: Tenta alinhar com a altura dos pré-requisitos
        materiasDoPeriodo.sort((nodeA, nodeB) => {
            const getAvgY = (node) => {
                const preReqs = node.data.pre_requisitos_lista;
                if (!preReqs || preReqs.length === 0) return 99999;
                
                let sum = 0, count = 0;
                preReqs.forEach(preId => {
                    if (yPositions[preId] !== undefined) {
                        sum += yPositions[preId];
                        count++;
                    }
                });
                return count === 0 ? 99999 : sum / count;
            };
            return getAvgY(nodeA) - getAvgY(nodeB);
        });

        // Aplica a posição
        materiasDoPeriodo.forEach((n, rowIndex) => {
            n.position = { 
                x: colIndex * X_SPACING, 
                y: rowIndex * Y_SPACING 
            };
            yPositions[n.data.id] = n.position.y;
        });
    });

    // 2. CONFIGURAÇÃO DO CYTOSCAPE
    const cy = cytoscape({
        container: document.getElementById('cy'),

        // Configurações "Travadas" (Static)
        autoungrabify: true,      // Não pode arrastar nós
        userPanningEnabled: true, // Pode mover a tela
        userZoomingEnabled: true, // Pode dar zoom
        boxSelectionEnabled: false,

        elements: { nodes: nodes, edges: edges },

        layout: { 
            name: 'preset', // Usa as posições que calculamos acima
            fit: true,
            padding: 40
        },

        style: [
            // Estilo dos Nós (Cards)
            {
                selector: 'node',
                style: {
                    'shape': 'round-rectangle',
                    'width': 220,
                    'height': 60,
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'text-wrap': 'wrap',
                    'text-max-width': 200,
                    'background-color': '#fff',
                    'border-width': 1,
                    'border-color': '#ccc',
                    'font-size': 11,
                    'color': '#333',
                    'font-weight': 'bold',
                    'text-transform': 'uppercase',
                    'transition-property': 'background-color, border-color, opacity',
                    'transition-duration': '0.2s'
                }
            },
            // Estilo das Arestas (Limpas/Invisíveis)
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'curve-style': 'unbundled-bezier',
                    'control-point-distances': 25,
                    'line-color': '#e2e8f0', // Quase transparente
                    'target-arrow-shape': 'none', 
                    'opacity': 0.5
                }
            },
            // --- Interações (Hover) ---
            {
                selector: '.faded',
                style: { 'opacity': 0.1 }
            },
            {
                selector: 'node.hover',
                style: {
                    'background-color': '#eff6ff',
                    'border-color': '#2563eb',
                    'border-width': 3,
                    'color': '#1e3a8a',
                    'z-index': 9999
                }
            },
            {
                selector: 'node.neighbor', // Vizinhos
                style: {
                    'background-color': '#f8fafc',
                    'border-color': '#64748b'
                }
            },
            {
                selector: 'edge.highlight', // Caminho iluminado
                style: {
                    'line-color': '#94a3b8',
                    'width': 3,
                    'opacity': 1,
                    'z-index': 999
                }
            }
        ]
    });

    // 3. LÓGICA DA SIDEBAR (DIREITA) E HOVER
    cy.on('mouseover', 'node', (e) => {
        const node = e.target;
        
        // --- Atualiza Sidebar (HTML) ---
        // Certifique-se que no HTML existem os IDs: lbl-nome, lbl-periodo, lbl-pre, lbl-pos
        const elNome = document.getElementById('lbl-nome');
        const contentDiv = document.getElementById('info-content');
        const placeDiv = document.getElementById('info-placeholder');

        if(elNome) {
            contentDiv.style.display = 'block';
            placeDiv.style.display = 'none';

            elNome.innerText = node.data('label');
            document.getElementById('lbl-periodo').innerText = node.data('periodo') + 'º Período';

            // Como suas arestas são (Matéria -> Pré), os targets são os pré-requisitos
            const preReqs = node.outgoers().targets().map(n => n.data('label'));
            document.getElementById('lbl-pre').innerText = preReqs.length ? preReqs.join(', ') : 'Nenhum';

            // As sources que apontam pra mim são o que eu libero
            const unlocks = node.incomers().sources().map(n => n.data('label'));
            document.getElementById('lbl-pos').innerText = unlocks.length ? unlocks.join(', ') : 'Fim de trilha';
        }

        // --- Efeitos Visuais ---
        cy.elements().removeClass('faded hover neighbor highlight');
        cy.elements().addClass('faded'); // Apaga tudo
        
        // Acende o nó atual e vizinhos
        node.removeClass('faded').addClass('hover');
        node.neighborhood().removeClass('faded').addClass('neighbor');
        node.connectedEdges().removeClass('faded').addClass('highlight');
    });

    cy.on('mouseout', 'node', () => {
        cy.elements().removeClass('faded hover neighbor highlight');
    });

    // Garante que cabe na tela ao iniciar
    cy.ready(() => {
        cy.fit(nodes, 30);
    });
}