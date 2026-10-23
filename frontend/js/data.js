/* ============================================================
 * 文枢 · 演示数据（前端原型专用，后续由后端 API 提供）
 * 数据模型与 README.md 中的「后端对接预留」一一对应
 * ============================================================ */

window.DB = {
  /* ---------- 分类（树形，parent 引用） ---------- */
  categories: [
    { id: "cv",          name: "计算机视觉",     parent: null },
    { id: "cv-cls",      name: "图像分类与识别", parent: "cv" },
    { id: "cv-gen",      name: "生成模型",       parent: "cv" },
    { id: "cv-seg",      name: "图像分割",       parent: "cv" },
    { id: "nlp",         name: "自然语言处理",   parent: null },
    { id: "nlp-pre",     name: "预训练模型",     parent: "nlp" },
    { id: "nlp-reason",  name: "推理与对齐",     parent: "nlp" },
    { id: "classic",     name: "经典与理论",     parent: null },
  ],

  /* ---------- 文献 ---------- */
  papers: [
    {
      id: "p1", title: "Attention Is All You Need", zh: "注意力机制就是你所需要的",
      authors: "Vaswani, Shazeer, Parmar, et al.", venue: "NeurIPS", year: 2017, type: "会议",
      cat: "nlp", tags: ["Transformer", "注意力机制", "机器翻译"],
      translated: true, summarized: true, unread: false, fav: true, cover: 0, added: "2026-09-12",
      abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, a new simple network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train."
    },
    {
      id: "p2", title: "Deep Residual Learning for Image Recognition", zh: "用于图像识别的深度残差学习",
      authors: "He, Zhang, Ren, Sun", venue: "CVPR", year: 2016, type: "会议",
      cat: "cv-cls", tags: ["CNN", "残差网络", "图像识别"],
      translated: true, summarized: true, unread: false, fav: true, cover: 1, added: "2026-08-30",
      abstract: "Deeper neural networks are more difficult to train. We present a residual learning framework that eases the optimization of very deep networks by letting stacked layers fit a residual mapping instead of the underlying one. On ImageNet, networks with depths beyond one hundred layers achieve lower recognition error than shallower counterparts, and set new records on detection and localization tasks."
    },
    {
      id: "p3", title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding", zh: "BERT：面向语言理解的深度双向 Transformer 预训练",
      authors: "Devlin, Chang, Lee, Toutanova", venue: "NAACL", year: 2019, type: "会议",
      cat: "nlp-pre", tags: ["预训练", "语言模型"],
      translated: true, summarized: false, unread: false, fav: false, cover: 2, added: "2026-09-02",
      abstract: "We introduce BERT, a pre-trained language representation model that is deeply bidirectional. BERT jointly conditions on both left and right context in all layers, and can be fine-tuned with a single output layer for a wide range of tasks such as question answering and language inference, setting new state-of-the-art results on eleven NLP benchmarks."
    },
    {
      id: "p4", title: "Language Models are Few-Shot Learners", zh: null,
      authors: "Brown, Mann, Ryder, et al.", venue: "NeurIPS", year: 2020, type: "会议",
      cat: "nlp-pre", tags: ["少样本", "大模型"],
      translated: false, summarized: false, unread: true, fav: false, cover: 3, added: "2026-09-20",
      abstract: "We demonstrate that scaling up language models greatly improves task-agnostic few-shot performance. GPT-3, an autoregressive model with 175 billion parameters, achieves strong performance on many NLP tasks without any fine-tuning, sometimes rivaling or surpassing prior fine-tuned state of the art."
    },
    {
      id: "p5", title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale", zh: null,
      authors: "Dosovitskiy, Beyer, Kolesnikov, et al.", venue: "ICLR", year: 2021, type: "会议",
      cat: "cv-cls", tags: ["ViT", "图像分类"],
      translated: false, summarized: true, unread: false, fav: false, cover: 4, added: "2026-09-18",
      abstract: "We show that a pure Transformer applied directly to sequences of image patches performs very well on image classification. With pre-training on large amounts of data, Vision Transformers attain excellent results compared to state-of-the-art CNNs while requiring substantially fewer computational resources to train."
    },
    {
      id: "p6", title: "Learning Transferable Visual Models From Natural Language Supervision", zh: null,
      authors: "Radford, Kim, Hallacy, et al.", venue: "ICML", year: 2021, type: "会议",
      cat: "cv", tags: ["多模态", "对比学习", "零样本"],
      translated: false, summarized: false, unread: true, fav: true, cover: 5, added: "2026-10-01",
      abstract: "We construct a simple yet effective contrastive learning method to transfer visual representations from natural language supervision. CLIP zero-shot transfers to many image classification benchmarks and matches the accuracy of a fully supervised baseline, demonstrating robustness to distribution shift."
    },
    {
      id: "p7", title: "Denoising Diffusion Probabilistic Models", zh: "去噪扩散概率模型",
      authors: "Ho, Jain, Abbeel", venue: "NeurIPS", year: 2020, type: "会议",
      cat: "cv-gen", tags: ["扩散模型", "图像生成"],
      translated: true, summarized: true, unread: false, fav: false, cover: 0, added: "2026-08-22",
      abstract: "We present high quality image synthesis results using diffusion probabilistic models, a class of latent variable models trained with a variational bound. Our models achieve state-of-the-art Inception and FID scores, and reveal a close connection between diffusion models and denoising score matching."
    },
    {
      id: "p8", title: "Segment Anything", zh: null,
      authors: "Kirillov, Mintun, Ravi, et al.", venue: "ICCV", year: 2023, type: "会议",
      cat: "cv-seg", tags: ["分割", "零样本"],
      translated: false, summarized: false, unread: true, fav: false, cover: 2, added: "2026-10-03",
      abstract: "We introduce the Segment Anything project: an image segmentation model, a promptable segmentation task, and a large-scale segmentation dataset. The model supports zero-shot transfer to new visual concepts and tasks through prompt engineering."
    },
    {
      id: "p9", title: "Masked Autoencoders Are Scalable Vision Learners", zh: null,
      authors: "He, Chen, Xie, et al.", venue: "CVPR", year: 2022, type: "会议",
      cat: "cv-cls", tags: ["自监督", "掩码建模"],
      translated: false, summarized: false, unread: true, fav: false, cover: 3, added: "2026-09-25",
      abstract: "We mask random patches of the input image and reconstruct the missing pixels with an asymmetric encoder-decoder. Masked autoencoders learn good representations with high masking ratios and scale well, enabling efficient training of large vision models."
    },
    {
      id: "p10", title: "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows", zh: null,
      authors: "Liu, Lin, Cao, et al.", venue: "ICCV", year: 2021, type: "会议",
      cat: "cv-cls", tags: ["ViT", "主干网络"],
      translated: false, summarized: false, unread: false, fav: false, cover: 5, added: "2026-09-10",
      abstract: "We propose a hierarchical Transformer whose representation is computed with shifted windows. The shifted window scheme brings greater efficiency by limiting self-attention to non-overlapping local windows while allowing cross-window connection, making the architecture suitable as a general-purpose backbone for vision tasks."
    },
    {
      id: "p11", title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models", zh: null,
      authors: "Wei, Wang, Schuurmans, et al.", venue: "NeurIPS", year: 2022, type: "会议",
      cat: "nlp-reason", tags: ["提示工程", "推理"],
      translated: false, summarized: false, unread: true, fav: false, cover: 1, added: "2026-09-28",
      abstract: "We explore how chain-of-thought prompting, which produces a series of intermediate reasoning steps, significantly improves the ability of large language models to perform complex reasoning. Performance gains scale with model size and emerge on arithmetic, commonsense and symbolic reasoning tasks."
    },
    {
      id: "p12", title: "LLaMA: Open and Efficient Foundation Language Models", zh: null,
      authors: "Touvron, Lavril, Izacard, et al.", venue: "arXiv", year: 2023, type: "预印本",
      cat: "nlp-pre", tags: ["开源模型", "大模型"],
      translated: false, summarized: false, unread: true, fav: false, cover: 4, added: "2026-10-02",
      abstract: "We introduce a collection of foundation language models ranging from 7B to 65B parameters, trained on trillions of tokens. LLaMA-13B outperforms GPT-3 on most benchmarks while being ten times smaller, allowing single-GPU inference and further fine-tuning."
    },
    {
      id: "p13", title: "A Mathematical Theory of Communication", zh: "通信的数学理论",
      authors: "Claude E. Shannon", venue: "Bell System Technical Journal", year: 1948, type: "期刊",
      cat: "classic", tags: ["信息论", "经典"],
      translated: true, summarized: true, unread: false, fav: false, cover: 3, added: "2026-07-15",
      abstract: "A mathematical theory of communication is presented, in which the transmission of information is quantified by entropy. The theory establishes fundamental limits on data compression and on reliable transmission over noisy channels, laying the foundation of modern information theory."
    },
    {
      id: "p14", title: "ImageNet Classification with Deep Convolutional Neural Networks", zh: null,
      authors: "Krizhevsky, Sutskever, Hinton", venue: "NeurIPS", year: 2012, type: "会议",
      cat: "cv-cls", tags: ["CNN", "经典"],
      translated: false, summarized: false, unread: false, fav: false, cover: 0, added: "2026-08-12",
      abstract: "We trained a large, deep convolutional neural network to classify the 1.2 million high-resolution images in the LSVRC-2010 contest, achieving record-breaking results. The network uses ReLU activations, dropout and GPU-based training, substantially reducing the top-1 error relative to previous methods."
    },
  ],

  /* ---------- 翻译任务队列 ---------- */
  tasks: [
    { id: "t1", paperId: "p1", name: "Attention Is All You Need",  status: "done",    progress: 100, pages: 15, model: "deepseek-chat", time: "今天 10:24", note: "用时 4 分 12 秒 · 已生成对照版" },
    { id: "t2", paperId: "p5", name: "An Image is Worth 16x16 Words", status: "running", progress: 62,  pages: 18, model: "glm-4-flash",   time: "进行中",     note: "正在翻译第 12 / 18 页 · 预计还需 2 分钟" },
    { id: "t3", paperId: "p3", name: "BERT: Pre-training of Deep Bidirectional Transformers…", status: "queued", progress: 0, pages: 22, model: "deepseek-chat", time: "排队中", note: "前方还有 1 个任务" },
    { id: "t4", paperId: "p8", name: "Segment Anything",           status: "failed",  progress: 0,   pages: 23, model: "deepseek-chat", time: "今天 09:47", note: "第 12 页版面解析超时，可重试" },
  ],

  /* ---------- 提示词模板 ---------- */
  prompts: [
    {
      id: "d1", name: "默认 · 文献速读", desc: "快速把握论文全貌，输出结构化速读卡片", default: true,
      content: "你是学术文献助手。请阅读以下论文内容，用中文输出：\n1. 一句话总结\n2. 研究背景与动机\n3. 核心方法（分点）\n4. 实验结果与结论\n5. 局限与思考\n6. 关键要点（3-5 条）\n\n论文标题：{{title}}\n摘要：{{abstract}}\n输出语言：{{lang}}"
    },
    {
      id: "d2", name: "深度方法剖析", desc: "聚焦方法细节：架构、公式、复杂度与对比", default: false,
      content: "请以方法论的视角剖析论文《{{title}}》：\n1. 方法拆解（关键公式与设计选择）\n2. 与已有架构的对比\n3. 计算与参数复杂度分析\n4. 可复现性评估\n用中文输出，保留必要的英文术语。"
    },
    {
      id: "d3", name: "审稿人视角", desc: "以顶会审稿人的标准审视论文优缺点", default: false,
      content: "假设你是 {{venue}} 的审稿人，请评审论文《{{title}}》：\n1. 优点（3 条以上）\n2. 主要疑问与潜在风险\n3. 缺失的实验或论述\n4. 总体评价与修改建议\n用中文输出，语气专业克制。"
    },
    {
      id: "d4", name: "组会汇报版", desc: "适合口头汇报的五分钟讲述结构", default: false,
      content: "请为组会汇报整理论文《{{title}}》：\n1. 这篇论文做了什么（30 秒版本）\n2. 为什么重要\n3. 怎么做到的\n4. 结果如何\n5. 对我们课题的启发\n用中文输出，每部分不超过 3 句话。"
    },
  ],

  /* ---------- 设置 ---------- */
  settings: {
    provider: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    apiKey: "",
    hasKey: false,
    keyMasks: {},             // provider -> 已保存 Key 的掩码
    pendingKeys: {},          // provider -> 用户刚输入、尚未保存的 Key 明文
    model: "deepseek-chat",
    temperature: 0.3,
    /* 网页 AI：把本机浏览器嵌进应用，沿用已登录账号 */
    webAiURL: "https://chat.deepseek.com/",
    webAiSites: [],           // [{ name, url }]
    webAiBrowser: "",         // 空 = 自动挑第一个可用的（按 id：chrome / edge …）
    /* 手动指定的浏览器 exe 路径。空 = 自动检测（注册表 + 默认安装位置）。
       自动检测找不到时（装在 D 盘 / 便携版）填这里。 */
    webAiBrowserPath: "",
    engine: "bing",
    engineURL: "http://127.0.0.1:8130",
    target: "简体中文",
    dualDefault: true,
    formulaProtect: true,
    glossary: "CV术语表.csv",
    theme: "light",
    accent: "zhu",
  },

  providers: [
    { id: "openai",   name: "OpenAI 兼容", base: "https://api.openai.com/v1",            models: ["gpt-4o-mini", "gpt-4o"] },
    { id: "deepseek", name: "DeepSeek",    base: "https://api.deepseek.com/v1",          models: ["deepseek-chat", "deepseek-reasoner"] },
    { id: "zhipu",    name: "智谱 AI",     base: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4-flash", "glm-4-plus"] },
    { id: "custom",   name: "自定义",      base: "",                                     models: [] },
  ],
};

/* ============================================================
 * 重点文献的阅读器内容（英文原文 + 中文译文，模拟 PDF 页面）
 * 其余文献由 app.js 中的通用生成器产出
 * ============================================================ */

window.CONTENT = {
  p1: {
    en: [
      [
        { t: "title",   x: "Attention Is All You Need" },
        { t: "authors", x: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin" },
        { t: "affil",   x: "Google Brain · Google Research · University of Toronto" },
        { t: "label",   x: "Abstract" },
        { t: "p", x: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature." },
        { t: "h1", x: "1  Introduction" },
        { t: "p", x: "Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have firmly established themselves as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation. Numerous efforts have since continued to push the boundaries of recurrent language models and encoder-decoder architectures." },
        { t: "p", x: "The fundamental constraint of such architectures, however, is inherent to sequential computation: at every step the hidden state depends on the previous one, which precludes parallelization within training examples and becomes critical at longer sequence lengths." },
        { t: "p", x: "In this work we propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output." },
      ],
      [
        { t: "h1", x: "2  Background" },
        { t: "p", x: "Reducing sequential computation has also been the motivation of earlier works such as ByteNet and ConvS2S, both of which use convolutional networks as basic building blocks. These models, however, still require a number of operations that grows with the distance between positions, making learning of long-range dependencies harder." },
        { t: "h1", x: "3  Model Architecture" },
        { t: "p", x: "Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations to a sequence of continuous representations, and the decoder then generates an output sequence of symbols one element at a time." },
        {
          t: "table",
          caption: "Table 1: Maximum path lengths, per-layer complexity and minimum number of sequential operations for different layer types. n is the sequence length, d is the representation dimension, k is the kernel size.",
          head: ["Layer Type", "Complexity / Layer", "Sequential Ops", "Max Path Length"],
          rows: [
            ["Self-Attention", "O(n\u00B2 \u00B7 d)", "O(1)", "O(1)"],
            ["Recurrent", "O(n \u00B7 d\u00B2)", "O(n)", "O(n)"],
            ["Convolutional", "O(k \u00B7 n \u00B7 d\u00B2)", "O(1)", "O(log\u2096 n)"],
          ],
        },
        { t: "p", x: "The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder." },
      ],
      [
        { t: "h2", x: "3.2  Attention" },
        { t: "p", x: "An attention function can be described as mapping a query and a set of key-value pairs to an output, where the output is computed as a weighted sum of the values. We call our particular attention Scaled Dot-Product Attention: the input consists of queries and keys of dimension d\u2096, and values of dimension d\u1D65." },
        {
          t: "figure", kind: "bars",
          caption: "Figure 2: Quality (BLEU) versus training time on the WMT 2014 English-to-German task.",
          items: [
            { x: "GNMT + RL", v: 24.6, max: 30 },
            { x: "ConvS2S", v: 25.2, max: 30 },
            { x: "Transformer (base)", v: 27.3, max: 30 },
            { x: "Transformer (big)", v: 28.4, max: 30 },
          ],
        },
        { t: "p", x: "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. The queries, keys and values are linearly projected h times before attention is computed in parallel for each projection." },
        { t: "note", x: "Proceedings of NeurIPS 2017 · 演示页面，仅用于界面原型" },
      ],
    ],
    zh: [
      [
        { t: "title",   x: "注意力机制就是你所需要的" },
        { t: "authors", x: "A. Vaswani, N. Shazeer, N. Parmar 等 · 谷歌大脑 / 谷歌研究 / 多伦多大学" },
        { t: "label",   x: "摘要" },
        { t: "p", x: "当前主流的序列转换模型基于复杂的循环或卷积神经网络，这类网络包含编码器和解码器，性能最好的模型还通过注意力机制将两者连接起来。我们提出了一种新的简单网络架构——Transformer，它完全基于注意力机制，彻底摒弃了循环和卷积。在两项机器翻译任务上的实验表明，这类模型不仅质量更优，而且更具并行性，训练所需时间也显著减少。我们的模型在 WMT 2014 英德翻译任务上取得 28.4 BLEU，比包括集成模型在内的现有最佳结果提升了 2 BLEU 以上；在 WMT 2014 英法翻译任务上，模型在 8 块 GPU 上训练 3.5 天后取得 41.8 BLEU 的单模型新纪录，训练成本仅为文献中最佳模型的一小部分。" },
        { t: "h1", x: "1  引言" },
        { t: "p", x: "循环神经网络——尤其是长短时记忆网络（LSTM）与门控循环单元（GRU）——早已在语言建模、机器翻译等序列建模与转换任务中确立了最先进方法的地位。此后大量研究工作仍在不断推动循环语言模型与编码器-解码器架构的边界。" },
        { t: "p", x: "然而这类架构的根本约束源自其串行计算的本质：每一步的隐状态都依赖于上一步，这使得训练样本内部无法并行，且在较长序列上问题尤为突出。" },
        { t: "p", x: "本文提出 Transformer——一种完全摒弃递归结构、仅依靠注意力机制来建立输入与输出之间全局依赖关系的模型架构。" },
      ],
      [
        { t: "h1", x: "2  背景" },
        { t: "p", x: "减少串行计算同样是 ByteNet 与 ConvS2S 等早期工作的动机，它们都以卷积网络为基本构件。然而这些模型将两个位置关联起来所需的操作数仍随位置距离增长，使得长程依赖的学习变得更加困难。" },
        { t: "h1", x: "3  模型架构" },
        { t: "p", x: "大多数具有竞争力的神经序列转换模型都采用编码器-解码器结构：编码器将符号表示的输入序列映射为连续表示序列，解码器再逐个元素地生成输出符号序列。" },
        {
          t: "table",
          caption: "表 1：不同层类型的最大路径长度、每层计算复杂度与最少串行操作数。n 为序列长度，d 为表示维度，k 为卷积核大小。",
          head: ["层类型", "每层复杂度", "串行操作", "最大路径长度"],
          rows: [
            ["自注意力", "O(n\u00B2 \u00B7 d)", "O(1)", "O(1)"],
            ["循环", "O(n \u00B7 d\u00B2)", "O(n)", "O(n)"],
            ["卷积", "O(k \u00B7 n \u00B7 d\u00B2)", "O(1)", "O(log\u2096 n)"],
          ],
        },
        { t: "p", x: "Transformer 沿用这一总体架构：编码器与解码器均由堆叠的自注意力层与逐位置全连接层组成。" },
      ],
      [
        { t: "h2", x: "3.2  注意力" },
        { t: "p", x: "注意力函数可以描述为：将一个查询（Query）与一组键值对（Key-Value）映射到输出，输出为各 Value 的加权和，权重由查询与对应 Key 的匹配度计算得到。我们将这种注意力称为「缩放点积注意力」：输入由维度为 d\u2096 的查询与键、维度为 d\u1D65 的值组成。" },
        {
          t: "figure", kind: "bars",
          caption: "图 2：WMT 2014 英德翻译任务上 BLEU 分数与训练时长的关系。",
          items: [
            { x: "GNMT + RL", v: 24.6, max: 30 },
            { x: "ConvS2S", v: 25.2, max: 30 },
            { x: "Transformer (base)", v: 27.3, max: 30 },
            { x: "Transformer (big)", v: 28.4, max: 30 },
          ],
        },
        { t: "p", x: "多头注意力让模型能够在不同位置的多个表示子空间中共同关注信息。查询、键与值会先被线性投影 h 次，再对各投影并行地计算注意力。" },
        { t: "note", x: "NeurIPS 2017 会议论文 · 由 deepseek-chat 翻译，仅供参考，请以原文为准" },
      ],
    ],
  },
};

/* ---------- AI 总结内容（p1 按提示词模板区分；其余文献走通用生成器） ---------- */

window.SUMMARY_P1 = {
  d1: {
    meta: "deepseek-chat · 默认 · 文献速读",
    sections: [
      { h: "一句话总结", type: "p", x: "论文提出 Transformer——一种完全依赖注意力机制、彻底摒弃循环与卷积的序列转换架构，在机器翻译任务上以更低的训练成本取得了当时最优的结果。" },
      { h: "研究背景", type: "p", x: "此前主导序列建模的 RNN / LSTM / GRU 结构按时间步串行计算，难以并行，长距离依赖的传递路径也较长；卷积模型虽可并行，但远距离位置之间的对齐仍需堆叠很多层。作者希望找到一种既保留长程建模能力、又能高度并行的新架构。" },
      { h: "核心方法", type: "ul", x: [
        "多头自注意力：将 Q / K / V 投影到多个子空间并行计算注意力，再拼接输出；",
        "位置编码：模型不含循环与卷积，使用正弦函数编码向模型注入序列顺序信息；",
        "编码器–解码器堆叠：每层由自注意力 + 前馈网络组成，配合残差连接与 LayerNorm；",
        "训练技巧：Label Smoothing、Warmup 学习率调度与 Adam 优化器。",
      ] },
      { h: "实验结果", type: "p", x: "在 WMT 2014 英→德翻译任务上取得 28.4 BLEU，超过此前包括集成模型在内的所有结果 2 BLEU 以上；英→法任务取得 41.8 BLEU，8 卡 GPU 仅训练 3.5 天，计算量约为以往最优模型的四分之一。" },
      { h: "局限与思考", type: "p", x: "自注意力对序列长度呈二次复杂度，长文档场景开销大；位置信息需要额外编码，向更长序列外推的能力有限；论文当时仅验证了翻译任务，其在预训练与多模态方向的潜力尚未显现。" },
      { h: "关键要点", type: "ul", x: [
        "Transformer 用注意力完全替代递归结构，训练并行度大幅提升；",
        "多头机制让模型在不同表示子空间同时关注不同位置；",
        "该架构成为后续 BERT、GPT 等预训练模型的基座。",
      ] },
    ],
  },
  d2: {
    meta: "deepseek-chat · 深度方法剖析",
    sections: [
      { h: "一句话总结", type: "p", x: "从方法论看，Transformer 的关键在于用「缩放点积注意力 + 多头投影」替代递归，把序列建模问题转化为可完全并行的一组矩阵运算。" },
      { h: "方法拆解", type: "ul", x: [
        "缩放点积注意力：Attention(Q, K, V) = softmax(QK\u1D40 / \u221Ad\u2096)V，除以 \u221Ad\u2096 是为了在维度较大时抵消点积方差过大、 softmax 进入梯度饱和区的问题；",
        "多头机制：先线性投影 h 次再分别注意力，等价于在多个低维子空间同时建模不同的对齐关系；",
        "前馈层：逐位置两层 MLP（先升维 4 倍再降回），为注意力输出提供非线性变换；",
        "Post-LN 结构：残差连接之后做 LayerNorm，训练时需要 Warmup 稳定早期梯度。",
      ] },
      { h: "复杂度分析", type: "p", x: "自注意力每层为 O(n\u00B2·d)，高于循环层的 O(n·d\u00B2)；但当 n < d 时计算量更小，且所有位置可以完全并行。最大路径长度 O(1)，是长程依赖建模能力的根本优势。" },
      { h: "与已有架构对比", type: "p", x: "相比 ByteNet / ConvS2S 以膨胀卷积扩大感受野、路径长度随距离对数增长，Transformer 将其降为常数；相比循环模型，串行操作从 O(n) 降为 O(1)。" },
      { h: "可复现性评估", type: "p", x: "论文给出了完整的超参表与训练配置，后续开源复现（如 Tensor2Tensor、fairseq）均能对齐原文结果，可复现性好。" },
    ],
  },
  d3: {
    meta: "deepseek-chat · 审稿人视角",
    sections: [
      { h: "优点", type: "ul", x: [
        "架构创新点明确：完全移除递归与卷积，思想简洁而彻底；",
        "实验充分：在两个大规模翻译任务上均取得显著提升，并给出训练成本对比；",
        "消融完整：对头数、模型维度、 dropout、标签平滑等关键超参均做了消融。",
      ] },
      { h: "主要疑问与潜在风险", type: "ul", x: [
        "自注意力的二次复杂度如何扩展到长序列（如文档级翻译）；",
        "正弦位置编码与学习式位置编码的差异未充分比较；",
        "仅覆盖机器翻译，泛化到其他序列任务尚需验证。",
      ] },
      { h: "总体评价", type: "p", x: "开创性工作，架构、实验与写作质量俱佳。即使某些设计选择的解释仍偏经验性，其对领域的深远影响足以弥补。建议接收。" },
    ],
  },
  d4: {
    meta: "deepseek-chat · 组会汇报版",
    sections: [
      { h: "这篇论文做了什么", type: "p", x: "提出 Transformer：完全用注意力机制替代循环和卷积的序列转换模型（30 秒版本：把 RNN 扔掉，只留注意力，翻译效果更好、训练更快）。" },
      { h: "为什么重要", type: "p", x: "训练并行度大幅提升，长程依赖路径降为常数；后来 BERT、GPT 等一系列大模型都构建在这一架构之上。" },
      { h: "怎么做到的", type: "p", x: "多头自注意力 + 位置编码 + 编码器-解码器堆叠，配合 Warmup 调度与 Label Smoothing 完成训练。" },
      { h: "结果如何", type: "p", x: "WMT 2014 英德 28.4 BLEU、英法 41.8 BLEU，均刷新当时纪录；训练成本约为以往最优模型的四分之一。" },
      { h: "对我们的启发", type: "p", x: "「结构先验让位给数据与注意力」的思路值得借鉴；组内涉及序列建模的模块可优先考虑注意力化改造。" },
    ],
  },
};
