'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icons';

const sourceRepositoryUrl = 'https://github.com/wyghxy/yuantanzhang-community';
const commercialPlatformUrl = 'https://yuantanzhang.cn/workspace';
const licenceUrl = `${sourceRepositoryUrl}/blob/main/LICENSING.md`;

const chapters = [
  { id: 'hero', label: '起点' },
  { id: 'about', label: '关于' },
  { id: 'projects', label: '开放范围' },
  { id: 'footprint', label: '发行记录' },
  { id: 'collaboration', label: '许可与边界' },
];

const projects: {
  number: string;
  icon: IconName;
  title: string;
  description: string;
  features: string[];
  action: string;
}[] = [
  {
    number: '01',
    icon: 'library',
    title: '素材整理',
    description: '把值得读的文章和笔记放到一起。保留原文，选中一句话，留下自己的判断。',
    features: ['粘贴与文本导入', '搜索与来源筛选', '原文摘录与笔记'],
    action: '打开素材库',
  },
  {
    number: '02',
    icon: 'write',
    title: '手动写作',
    description: '在资料旁写下自己的表达。摘录提供线索，稿件保留你的声音。',
    features: ['原文与稿件对照', '富文本编辑', '保存与 Markdown 导出'],
    action: '打开写作台',
  },
];

export default function PublicHome() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('hero');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let prefersDark = false;
    try {
      const preference = localStorage.getItem('community-desk-theme');
      prefersDark = preference ? preference === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { /* A theme preference is optional. */ }
    setDark(prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { root, rootMargin: '-12% 0px -40% 0px', threshold: 0 });
    for (const chapter of chapters) {
      const section = root.querySelector(`#${chapter.id}`);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem('community-desk-theme', next ? 'dark' : 'light'); } catch { /* A theme preference is optional. */ }
  }

  return <div className="public-home" ref={scrollRef}>
    <a className="home-skip-link" href="#home-main">跳到主要内容</a>
    <header className="home-header">
      <div className="home-header-inner home-container">
        <a className="home-brand" href="#hero" aria-label="元探长，返回起点" onClick={() => setMenuOpen(false)}>
          <span className="home-brand-mark"><Icon name="write" size={22}/></span>
          <strong>元探长</strong>
          <span className="home-edition">个人版</span>
        </a>
        <nav className={`home-nav ${menuOpen ? 'is-open' : ''}`} id="home-navigation" aria-label="首页章节导航">
          {chapters.map((chapter) => <a key={chapter.id} href={`#${chapter.id}`} aria-current={active === chapter.id ? 'location' : undefined} onClick={() => setMenuOpen(false)}>{chapter.label}</a>)}
        </nav>
        <div className="home-header-actions">
          <button className="home-theme-button" aria-label={dark ? '切换浅色主题' : '切换深色主题'} title={dark ? '浅色主题' : '深色主题'} onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} size={19}/></button>
          <a className="button home-header-desk" href="/desk/">打开工作台<Icon name="chevron" size={14}/></a>
          <button className="home-menu-button" aria-label={menuOpen ? '关闭章节导航' : '打开章节导航'} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} size={21}/></button>
        </div>
      </div>
    </header>

    <main id="home-main">
      <section className="home-hero" id="hero" aria-labelledby="hero-title">
        <div className="home-hero-grid" aria-hidden="true"/>
        <div className="home-container home-hero-inner">
          <div className="home-hero-copy">
            <span className="home-kicker"><i/>SOURCE AVAILABLE · PERSONAL EDITION</span>
            <h1 id="hero-title">一站式创作工作台</h1>
            <p className="home-hero-slogan" lang="en">DARE TO ACT</p>
            <div className="home-product-actions">
              <a className="home-product-option home-product-option--source" href={sourceRepositoryUrl} target="_blank" rel="noopener noreferrer">
                <span className="home-product-option-meta"><span>PERSONAL</span><Icon name="link" size={16}/></span>
                <strong>个人版</strong>
                <small>开源版</small>
              </a>
              <a className="home-product-option home-product-option--cloud" href={commercialPlatformUrl} target="_blank" rel="noopener noreferrer">
                <span className="home-product-option-meta"><span>CONNECTED</span><Icon name="chevron" size={16}/></span>
                <strong>元空间</strong>
                <small>联网版</small>
              </a>
            </div>
            <p className="home-hero-requirements"><Icon name="check" size={14}/>本地优先 · 无需账号 · 当前版本以手动导入为主</p>
          </div>

          <figure className="home-preview">
            <div className="home-preview-top"><span><i/><i/><i/></span><span>元探长 / 个人工作台</span><span>LOCAL-FIRST</span></div>
            <div className="home-preview-image"><img src="/showcase/workbench.png" alt="元探长个人社区版的真实桌面工作台截图" width={1440} height={900} fetchPriority="high"/></div>
            <figcaption><span>真实个人工作台 · 本地运行</span><span>READ / THINK / WRITE</span></figcaption>
          </figure>

          <div className="home-hero-facts" aria-label="个人版摘要">
            <div><span>01</span><strong>本地优先</strong><p>资料保存在当前浏览器</p></div>
            <div><span>02</span><strong>BYOK</strong><p>模型与外部服务自行配置</p></div>
            <div><span>03</span><strong>源码公开</strong><p>个人自用与本人账号变现免费</p></div>
          </div>
        </div>
      </section>

      <section className="home-about home-section" id="about" aria-labelledby="about-title">
        <div className="home-container">
          <div className="home-section-heading"><span className="home-section-label">01 / ABOUT</span><h2 id="about-title">先把边界说清楚，<br/>再把工具交给你。</h2></div>
          <div className="home-about-content">
            <div className="home-about-intro"><p>资料可以很多，<br/>自己的判断也值得被留下。</p><span>元探长 · 个人社区版</span></div>
            <div className="home-about-prose">
              <p>阅读时收藏的文章、随手记下的句子、还没展开的念头，往往散落在不同地方。这个工作台把它们放到同一张桌面：资料在旁，写作在前，中间是你的思考。</p>
              <p>本版只开放可独立运行的个人前端：手动导入素材、阅读原文、摘录笔记、富文本写作和本地备份。它不包含商业管理台、会员积分、计费系统、自动抓取接口或任何供应商密钥。</p>
              <p>需要联网模型、自动采集或转写能力时，请自行选择有权使用的服务、配置自己的凭据，并承担相应费用与合规责任。数据源平台、模型供应商和内容版权仍适用各自规则。</p>
              <p className="home-brand-note">这是非商业的源码公开版本；个人自用与本人账号内容变现免费，转售软件、销售使用权、经营收费软件服务或对外托管需要另行授权。</p>
            </div>
          </div>
          <div className="home-process" aria-label="个人创作过程"><div><span>01</span><strong>收集</strong><p>把有价值的资料留在手边</p></div><div><span>02</span><strong>阅读</strong><p>摘录句子，也记下自己的想法</p></div><div><span>03</span><strong>写作</strong><p>重新组织，形成自己的表达</p></div></div>
        </div>
      </section>

      <section className="home-projects home-section home-container" id="projects" aria-labelledby="projects-title">
        <div className="home-section-heading home-heading-row"><div><span className="home-section-label">02 / WHAT'S INSIDE</span><h2 id="projects-title">只开放真正属于<br/>个人工作的部分。</h2></div><p>功能写得再长，不如把一件事做完整。<br/>先把素材与写作跑通。</p></div>
        <div className="home-project-grid">{projects.map((project) => <article className="home-project" key={project.number}><div className="home-project-top"><span className="home-project-icon"><Icon name={project.icon} size={26}/></span><span>{project.number}</span></div><h3>{project.title}</h3><p>{project.description}</p><ul>{project.features.map((feature) => <li key={feature}><Icon name="check" size={14}/>{feature}</li>)}</ul><a href="/desk/" className="home-project-link">{project.action}<Icon name="chevron" size={16}/></a></article>)}</div>
        <div className="home-boundary-grid" aria-label="公开范围"><article><span>INCLUDED</span><h3>仓库包含</h3><p>可运行官网、个人工作台、手动素材导入、摘录笔记、写作编辑、本地 IndexedDB、JSON 备份与测试。</p></article><article><span>EXCLUDED</span><h3>明确排除</h3><p>管理后台、账号体系、会员积分、支付计费、自动采集接口、模型密钥、云托管和生产供应商实现。</p></article></div>
      </section>

      <section className="home-footprint home-section" id="footprint" aria-labelledby="footprint-title">
        <div className="home-container home-footprint-layout">
          <div className="home-section-heading"><span className="home-section-label">03 / RELEASE</span><h2 id="footprint-title">从能用，<br/>到可信。</h2><p className="home-section-description">公开版本只记录已经完成的验证，<br/>不把路线图伪装成现成功能。</p></div>
          <div className="home-timeline">
            <article><span className="home-timeline-dot"/><div className="home-release-meta"><span>个人社区版</span><span>v0.1.0 · SOURCE AVAILABLE</span></div><h3>个人工作台源码公开</h3><p>个人版官网、素材导入、阅读摘录、手动写作、本地保存与备份读回纳入独立公开仓库。商业产品代码、后台和生产配置不随仓库发布。</p><div className="home-release-tags"><span>本地数据</span><span>富文本写作</span><span>备份与导出</span><span>非商业许可</span></div></article>
            <article><span className="home-timeline-dot"/><div className="home-release-meta"><span>合规与维护</span><span>DOCUMENTED</span></div><h3>许可、免责声明和安全边界</h3><p>随源码提供许可说明、第三方通知、品牌边界、使用范围、免责声明及安全报告方式。使用外部服务前，请自行核验服务条款、版权、隐私和费用。</p><div className="home-release-tags"><span>PolyForm NC</span><span>Third-party notices</span><span>Security policy</span></div></article>
          </div>
        </div>
      </section>

      <section className="home-collaboration home-section home-container" id="collaboration" aria-labelledby="collaboration-title">
        <div>
          <span className="home-section-label">04 / LICENSE &amp; BOUNDARY</span>
          <h2 id="collaboration-title">自己掌控工具，<br/>也对自己的数据和合规负责。</h2>
          <p>源码公开不等于放弃署名、允许冒充官方或允许收费托管。使用前请阅读完整许可与实际范围，并保留版权与第三方通知。</p>
          <div className="home-collaboration-actions"><a className="button home-contact" href={sourceRepositoryUrl} target="_blank" rel="noopener noreferrer">查看 GitHub 源码<Icon name="link" size={16}/></a><a className="home-inline-link" href={licenceUrl} target="_blank" rel="noopener noreferrer">阅读许可说明<Icon name="chevron" size={14}/></a></div>
        </div>
        <aside className="home-permission-note"><span className="home-permission-icon"><Icon name="file" size={23}/></span><h3>使用边界</h3><p>个人自用及本人账号内容变现免费；禁止转售软件、销售使用权、收费 SaaS／API、代部署和对外托管。</p><p>软件按现状提供，不承诺无错误、持续可用或生成结果正确。素材权利、平台规则、模型费用、数据备份和最终内容审核由使用者自行负责。</p><span>不是 OSI 标准开源许可证。准确范围以 LICENSING.md、LICENSE 和 DISCLAIMER.md 为准。</span></aside>
      </section>
    </main>

    <footer className="home-footer">
      <div className="home-container">
        <a className="home-footer-brand" href="#hero">元探长<span>个人社区版</span></a>
        <p>把资料读透，把想法写成作品。</p>
        <nav aria-label="页脚链接"><a href={sourceRepositoryUrl} target="_blank" rel="noopener noreferrer">GitHub</a><a href={`${sourceRepositoryUrl}/blob/main/DISCLAIMER.md`} target="_blank" rel="noopener noreferrer">免责声明</a><a href="#hero">回到起点<Icon name="chevron" size={13}/></a></nav>
      </div>
    </footer>
  </div>;
}
