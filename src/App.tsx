/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowDownRight, CheckCircle2, Loader2, Menu, X } from 'lucide-react';
import { Coastal3DStage } from './components/Coastal3DStage';
import { EditorialImage } from './components/EditorialImage';
import {
  EQUIPMENT_ITEMS,
  EquipmentCategory,
  HAENYEO_IMAGES,
  HERITAGE_FACTS,
  HERITAGE_PILLARS,
  SEASON_GUIDES,
  SeasonId,
  VISIT_SPOTS,
} from './data/haenyeoContent';

interface ReservationFormState {
  name: string;
  contact: string;
  program: string;
  date: string;
  guests: string;
  note: string;
}

const APPS_SCRIPT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwaZh0td9E5nHBI2UOJDNv-OogGyEvTpObddv8wFFTTeJWWQ2c7na2A5VtDeol6wf8a/exec';

const INITIAL_FORM: ReservationFormState = {
  name: '',
  contact: '',
  program: '법환 좀녀마을 해녀 물질 체험',
  date: '',
  guests: '2',
  note: '',
};

const EQUIPMENT_FILTERS: { id: EquipmentCategory; label: string }[] = [
  { id: 'all', label: '전체 도구' },
  { id: 'buoy', label: '부력·채취 도구' },
  { id: 'suit', label: '잠수 복장' },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentCategory>('all');
  const [selectedSeasonId, setSelectedSeasonId] = useState<SeasonId>('spring');

  const [form, setForm] = useState<ReservationFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const filteredEquipment = useMemo(() => {
    if (equipmentFilter === 'all') return EQUIPMENT_ITEMS;
    if (equipmentFilter === 'buoy') {
      return EQUIPMENT_ITEMS.filter((item) => item.category === 'buoy' || item.category === 'tool');
    }
    return EQUIPMENT_ITEMS.filter((item) => item.category === equipmentFilter);
  }, [equipmentFilter]);

  const activeSeason = useMemo(
    () => SEASON_GUIDES.find((s) => s.id === selectedSeasonId) ?? SEASON_GUIDES[0],
    [selectedSeasonId]
  );

  const updateFormField = <K extends keyof ReservationFormState>(
    key: K,
    value: ReservationFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitSuccess) {
      setSubmitSuccess(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = form.name.trim();
    const trimmedContact = form.contact.trim();
    const trimmedMessage = form.note.trim();

    if (trimmedName.length < 2) {
      setFormError('신청자 성함을 2자 이상 입력해 주세요.');
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact);
    const isPhone = /^[0-9+\-\s]{9,16}$/.test(trimmedContact);
    if (!isEmail && !isPhone) {
      setFormError('연락 가능한 휴대전화 번호 또는 이메일 주소를 정확히 입력해 주세요.');
      return;
    }

    if (!form.date) {
      setFormError('방문 희망 날짜를 선택해 주세요.');
      return;
    }

    setFormError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);

    const payload = {
      name: trimmedName,
      contact: trimmedContact,
      program: form.program,
      date: form.date,
      guests: form.guests,
      message: trimmedMessage,
    };

    try {
      await fetch(APPS_SCRIPT_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      setForm(INITIAL_FORM);
      setSubmitSuccess(true);
    } catch {
      setFormError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#F8FAFC]/95 border-b border-slate-200/90">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single Text Element Brand Wordmark */}
          <a
            href="#experience-3d"
            className="font-editorial text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            제주 해녀 아카이브
          </a>

          {/* Zone 2: 5 Concise Single-Line Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
            aria-label="주요 메뉴"
          >
            <a
              href="#experience-3d"
              className="hover:text-[#0E5A6F] transition-colors whitespace-nowrap shrink-0"
            >
              3D 해안 체험
            </a>
            <a
              href="#heritage"
              className="hover:text-[#0E5A6F] transition-colors whitespace-nowrap shrink-0"
            >
              해녀의 유산
            </a>
            <a
              href="#equipment"
              className="hover:text-[#0E5A6F] transition-colors whitespace-nowrap shrink-0"
            >
              물질 도구
            </a>
            <a
              href="#seasons"
              className="hover:text-[#0E5A6F] transition-colors whitespace-nowrap shrink-0"
            >
              계절 바다
            </a>
            <a
              href="#visit"
              className="hover:text-[#0E5A6F] transition-colors whitespace-nowrap shrink-0"
            >
              방문 안내
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#visit"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0E5A6F] hover:bg-[#0b4859] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              체험 예약
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4">
            <nav className="flex flex-col gap-3 text-sm font-medium text-slate-700">
              {[
                { href: '#experience-3d', label: '3D 해안 체험' },
                { href: '#heritage', label: '해녀의 유산' },
                { href: '#equipment', label: '물질 도구' },
                { href: '#seasons', label: '계절 바다' },
                { href: '#visit', label: '방문 안내' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1.5 hover:text-[#0E5A6F] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#visit"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#0E5A6F] text-white text-sm font-medium"
              >
                체험 예약
              </a>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* HERO SECTION & LIVE 3D INTERACTIVE SHOWCASE */}
        <section id="experience-3d" className="pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="max-w-7xl mx-auto px-6">
            {/* Editorial Title Block */}
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
                <span>유네스코 인류무형문화유산</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">2016년 등재</span>
                <span aria-hidden="true">·</span>
                <span>제주특별자치도 해양문화 기록</span>
              </div>

              <h1
                className="mt-4 font-editorial font-bold tracking-tight text-slate-900 leading-[1.22] [text-wrap:balance]"
                style={{ fontSize: 'clamp(2.1rem, 4.1vw, 3.4rem)' }}
              >
                숨비소리가 울려 퍼지는 제주 바다, 해녀의 숨결을 만나다
              </h1>

              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                산소통 없이 오직 한 번의 호흡으로 현무암 바닷속을 누비며 지속 가능한 바다 생태계를
                지켜온 제주 해녀의 삶과 문화를 소개합니다. 아래 3D 제주 해안도로에서 잠수복을 입고
                태왁과 한라봉을 실은 호랑이와 함께 제주 바다를 미리 달려보세요.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-5">
                <a
                  href="#visit"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0E5A6F] hover:bg-[#0b4859] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>해녀 문화 체험 예약하기</span>
                  <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                </a>
                <a
                  href="#heritage"
                  className="text-sm font-medium text-slate-700 hover:text-[#0E5A6F] underline underline-offset-4 decoration-slate-300 hover:decoration-[#0E5A6F] transition-colors whitespace-nowrap shrink-0"
                >
                  유네스코 문화유산 이야기 읽기
                </a>
              </div>
            </div>

            {/* Live Interactive 3D Jeju Haenyeo Tiger Coastal Showcase */}
            <div className="mt-10">
              <Coastal3DStage />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  그림 1. 제주 해녀 잠수복과 태왁, 한라봉 바구니, 점핑 남방큰돌고래가 어우러진
                  실시간 3D 제주 해안도로
                </span>
                <span>화면 클릭 시 제주 민요(오돌또기 · 너영나영)와 파도 소리가 재생됩니다</span>
              </div>
            </div>

            {/* Full-Width 4-Column Operational Heritage Fact Strip */}
            <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {HERITAGE_FACTS.map((fact) => (
                <div key={fact.label} className="flex flex-col">
                  <span className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#0E5A6F] tracking-tight">
                    {fact.value}
                  </span>
                  <span className="mt-2 text-sm font-semibold text-slate-900">{fact.label}</span>
                  <span className="mt-1 text-xs text-slate-500 leading-relaxed">{fact.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 01: HAENYEO HERITAGE & PHILOSOPHY */}
        <section id="heritage" className="py-20 sm:py-24 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[#0E5A6F] tracking-wide">
                01. 제주해녀문화의 가치
              </p>
              <h2 className="mt-2 font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                바다를 소유하지 않고 함께 숨 쉬는 공동체의 지혜
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                제주 해녀 문화는 단순한 어로 기술을 넘어 자연과의 공존, 세대 간 전승, 그리고
                여성이 주도하는 협동 공동체의 정신을 담은 소중한 인류 자산입니다.
              </p>
            </div>

            {/* 2-Column Editorial Split (items-stretch for balanced heights) */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex">
                <EditorialImage
                  src={HAENYEO_IMAGES.seaHeritage}
                  alt="이른 아침 현무암 바닷가로 테왁과 망사리를 메고 입수하는 제주 해녀들"
                  caption="그림 2. 제주 동부 현무암 연안에서 물때에 맞춰 바다로 향하는 해녀들의 아침 물질 풍경"
                  aspectClass="aspect-[4/3] lg:aspect-auto lg:h-full"
                  className="w-full"
                />
              </div>

              <div className="lg:col-span-6 flex flex-col justify-between divide-y divide-slate-200">
                {HERITAGE_PILLARS.map((pillar) => (
                  <article key={pillar.index} className="py-6 first:pt-0 last:pb-0">
                    <div className="flex items-baseline gap-3 text-xs text-slate-500">
                      <span className="font-mono-tabular font-semibold text-[#0E5A6F]">
                        {pillar.index}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{pillar.subtitle}</span>
                    </div>
                    <h3 className="mt-2 font-editorial text-xl font-semibold text-slate-900">
                      {pillar.title}
                    </h3>
                    <p className="mt-2.5 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                      {pillar.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {/* Curatorial Pull Quote (Top & Bottom Hairline Rules — Zero Left Accent Bars) */}
            <blockquote className="mt-16 py-10 border-y border-slate-200 max-w-4xl mx-auto text-center">
              <p className="font-editorial text-xl sm:text-2xl lg:text-[26px] text-slate-800 leading-relaxed [text-wrap:balance]">
                “저승에서 벌어 이승에서 쓴다 하지만, 욕심내어 물숨만 마시지 않으면 바다는 언제나
                우리 식구를 먹여 살려 줍니다.”
              </p>
              <footer className="mt-4 text-xs sm:text-sm text-slate-500">
                제주 해녀 구술 아카이브 · 구좌읍 하도리 상군 해녀 구술 채록 중에서
              </footer>
            </blockquote>
          </div>
        </section>

        {/* SECTION 02: HAENYEO EQUIPMENT MUSEUM CATALOG */}
        <section id="equipment" className="py-20 sm:py-24 bg-[#F8FAFC] border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-[#0E5A6F] tracking-wide">
                  02. 물질 도구 도감
                </p>
                <h2 className="mt-2 font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                  오랜 세월 바다에 맞춰 다듬어진 해녀의 도구들
                </h2>
              </div>

              {/* Interactive Category Filter Tabs */}
              <div
                className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg self-start md:self-auto"
                role="tablist"
                aria-label="물질 도구 분류"
              >
                {EQUIPMENT_FILTERS.map((tab) => {
                  const active = equipmentFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setEquipmentFilter(tab.id)}
                      className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Featured Museum Plate: Taewak & Tools */}
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 flex">
                <EditorialImage
                  src={HAENYEO_IMAGES.taewakGear}
                  alt="제주 현무암 바위 위에 놓인 주황색 태왁과 망사리, 물안경, 빗창"
                  caption="그림 3. 제주 현무암 해안에 놓인 해녀 물질 도구 일체 — 주황색 태왁, 손뜨개 망사리, 물안경, 단조 빗창"
                  aspectClass="aspect-[16/9] lg:aspect-auto lg:h-full"
                  className="w-full"
                />
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-[#D9531E]">JH-01</span>
                    <span aria-hidden="true">·</span>
                    <span>대표 소장 도구</span>
                    <span aria-hidden="true">·</span>
                    <span>제주어 테왁 / 망시리</span>
                  </div>
                  <h3 className="mt-3 font-editorial text-2xl font-bold text-slate-900">
                    태왁과 망사리
                  </h3>
                  <p className="mt-3 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                    예전에는 속을 비운 박을 말려 썼고 오늘날에는 스티로폼 부표에 주황색 천을 씌워
                    사용합니다. 바다 위에서 해녀의 몸을 떠받치는 생명줄이자, 어선과 동료에게 위치를
                    알리는 해상 신호등 역할을 합니다.
                  </p>
                </div>

                <dl className="mt-6 pt-5 border-t border-slate-200 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">주요 재료</dt>
                    <dd className="text-slate-900 font-medium text-right">
                      부표 · 주황색 방수천 · 매듭 그물망
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">핵심 기능</dt>
                    <dd className="text-slate-900 font-medium text-right">
                      수면 휴식 부력 · 해산물 신선 보관
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">식별 색상</dt>
                    <dd className="text-slate-900 font-medium text-right">
                      높은 해상 시인성의 주황·흰색
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Filtered Equipment Catalog Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEquipment.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono-tabular font-semibold text-[#0E5A6F]">
                        {item.accessionNo}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.categoryLabel}</span>
                    </div>
                    <h3 className="mt-2.5 font-editorial text-lg font-bold text-slate-900">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">{item.jejuName}</p>
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <dl className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 shrink-0">재질</dt>
                      <dd className="text-slate-800 text-right">{item.material}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 shrink-0">역할</dt>
                      <dd className="text-slate-800 text-right">{item.role}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 03: SEASONAL HARVEST CALENDAR & SUSTAINABILITY */}
        <section id="seasons" className="py-20 sm:py-24 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-[#0E5A6F] tracking-wide">
                  03. 제주의 사계절 바다
                </p>
                <h2 className="mt-2 font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                  물때와 금어기를 따르는 계절별 채취 달력
                </h2>
              </div>

              {/* 4-Season Interactive Switcher */}
              <div
                className="inline-flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-lg self-start md:self-auto"
                role="tablist"
                aria-label="계절 선택"
              >
                {SEASON_GUIDES.map((season) => {
                  const active = season.id === selectedSeasonId;
                  return (
                    <button
                      key={season.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedSeasonId(season.id)}
                      className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#0E5A6F] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {season.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              {/* Left: Active Season Table & Ecological Notes */}
              <div className="lg:col-span-7 flex flex-col justify-between bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 sm:p-8">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500">
                    <span className="font-semibold text-[#0E5A6F]">{activeSeason.label}철 물질</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{activeSeason.months}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">평균 수온 {activeSeason.waterTemp}</span>
                  </div>

                  <h3 className="mt-3 font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                    {activeSeason.headline}
                  </h3>
                  <p className="mt-3 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                    {activeSeason.summary}
                  </p>

                  {/* Structured Tabular Harvest Schedule (Mobile Stacked List + Desktop Table) */}
                  <div className="mt-6">
                    {/* Mobile View (< sm): Breathable stacked rows with natural Korean word wrapping */}
                    <div className="sm:hidden divide-y divide-slate-200/90 border-t border-b border-slate-200">
                      {activeSeason.rows.map((row) => (
                        <div key={row.species} className="py-4 space-y-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold text-sm text-slate-900 break-keep">
                              {row.species}
                            </span>
                            <span className="font-mono-tabular text-xs font-medium text-[#0E5A6F] whitespace-nowrap shrink-0">
                              수심 {row.depth}
                            </span>
                          </div>
                          <dl className="space-y-1.5 text-xs leading-relaxed">
                            <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-baseline">
                              <dt className="text-slate-500 font-medium whitespace-nowrap">
                                자율 보호 규율
                              </dt>
                              <dd className="text-slate-800 break-keep">{row.rule}</dd>
                            </div>
                            <div className="grid grid-cols-[5.5rem_1fr] gap-2 items-baseline">
                              <dt className="text-slate-500 font-medium whitespace-nowrap">비고</dt>
                              <dd className="text-slate-600 break-keep">{row.note}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>

                    {/* Tablet & Desktop View (sm+): Clean 4-column table with break-keep Korean typography */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs text-slate-500">
                            <th className="py-3 pr-4 font-medium whitespace-nowrap">주요 해산물</th>
                            <th className="py-3 pr-4 font-medium whitespace-nowrap">채취 수심</th>
                            <th className="py-3 pr-4 font-medium whitespace-nowrap">자율 보호 규율</th>
                            <th className="py-3 font-medium whitespace-nowrap">비고</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80">
                          {activeSeason.rows.map((row) => (
                            <tr key={row.species} className="align-top">
                              <td className="py-3.5 pr-4 font-semibold text-slate-900 whitespace-nowrap">
                                {row.species}
                              </td>
                              <td className="py-3.5 pr-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                                {row.depth}
                              </td>
                              <td className="py-3.5 pr-5 text-slate-700 leading-relaxed break-keep">
                                {row.rule}
                              </td>
                              <td className="py-3.5 text-slate-500 leading-relaxed break-keep">
                                {row.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <p className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
                  * 제주 지역 어촌계별 기상 조건과 수산자원 보호 조례에 따라 세부 금어기 일정 및
                  물질 허용 시간이 탄력적으로 운영됩니다.
                </p>
              </div>

              {/* Right: Fresh Coastal Harvest Documentary Photo */}
              <div className="lg:col-span-5 flex">
                <EditorialImage
                  src={HAENYEO_IMAGES.seafoodHarvest}
                  alt="제주 현무암 바위 위 그물망에 담긴 전복, 뿔소라, 성게, 자연산 미역"
                  caption="그림 4. 물질을 마친 직후 망사리에 담긴 제주 자연산 참전복, 뿔소라, 보라성게와 미역"
                  aspectClass="aspect-[4/3] lg:aspect-auto lg:h-full"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 04: VISIT GUIDE & INTERACTIVE EXPERIENCE RESERVATION */}
        <section id="visit" className="py-20 sm:py-24 bg-[#F8FAFC] border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[#0E5A6F] tracking-wide">
                04. 방문 및 체험 안내
              </p>
              <h2 className="mt-2 font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                제주 해녀의 현장을 직접 만나보세요
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                전시 관람부터 해녀와 함께하는 얕은 바다 물질 체험, 성산일출봉 해녀 공연까지 제주
                곳곳에서 살아 있는 해녀 문화를 경험할 수 있습니다.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Column: Harbor Plate + 3 Real Jeju Visitor Spots */}
              <div className="lg:col-span-7 space-y-8">
                <EditorialImage
                  src={HAENYEO_IMAGES.bulteokHarbor}
                  alt="제주 바다 포구가 내려다보이는 전통 현무암 불턱 돌담과 에메랄드빛 연안"
                  caption="그림 5. 해녀들이 바람을 피하고 휴식을 취하던 전통 현무암 불턱과 제주 동부 연안 포구"
                  aspectClass="aspect-[16/9]"
                />

                <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                  {VISIT_SPOTS.map((spot) => (
                    <div key={spot.name} className="py-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-editorial text-lg font-bold text-slate-900">
                          {spot.name}
                        </h3>
                        <span className="font-mono-tabular text-xs text-[#0E5A6F] font-medium">
                          {spot.hours}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{spot.region}</p>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{spot.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Validated Interactive Experience Booking Form via Google Apps Script */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                <h3 className="font-editorial text-xl font-bold text-slate-900">
                  해녀 문화 체험 · 해설 예약 문의
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  희망하는 프로그램과 방문 일정을 입력해 주시면 물때와 기상 상황을 확인한 뒤
                  안내드리겠습니다.
                </p>

                <form onSubmit={handleFormSubmit} className="mt-5 space-y-4" noValidate>
                  <div>
                    <label htmlFor="booking-name" className="block text-xs font-medium text-slate-700">
                      신청자 성함
                    </label>
                    <input
                      id="booking-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      placeholder="홍길동"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-[#0E5A6F]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-contact"
                      className="block text-xs font-medium text-slate-700"
                    >
                      연락처 또는 이메일
                    </label>
                    <input
                      id="booking-contact"
                      type="text"
                      required
                      value={form.contact}
                      onChange={(e) => updateFormField('contact', e.target.value)}
                      placeholder="010-1234-5678 또는 name@example.com"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-[#0E5A6F]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-program"
                      className="block text-xs font-medium text-slate-700"
                    >
                      희망 프로그램
                    </label>
                    <select
                      id="booking-program"
                      value={form.program}
                      onChange={(e) => updateFormField('program', e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-2 focus:outline-[#0E5A6F]"
                    >
                      <option value="법환 좀녀마을 해녀 물질 체험">
                        법환 좀녀마을 해녀 물질 체험 (약 90분)
                      </option>
                      <option value="제주 해녀박물관 도슨트 단체 해설">
                        제주 해녀박물관 도슨트 단체 해설 (약 60분)
                      </option>
                      <option value="성산일출봉 해녀 공연 및 이야기 마당">
                        성산일출봉 해녀 공연 및 이야기 마당
                      </option>
                      <option value="제주 해녀 밥상 · 계절 식문화 체험">
                        제주 해녀 밥상 · 계절 식문화 체험
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="booking-date"
                        className="block text-xs font-medium text-slate-700"
                      >
                        방문 희망일
                      </label>
                      <input
                        id="booking-date"
                        type="date"
                        required
                        value={form.date}
                        onChange={(e) => updateFormField('date', e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 font-mono-tabular focus:outline-2 focus:outline-[#0E5A6F]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="booking-guests"
                        className="block text-xs font-medium text-slate-700"
                      >
                        참여 인원
                      </label>
                      <select
                        id="booking-guests"
                        value={form.guests}
                        onChange={(e) => updateFormField('guests', e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 font-mono-tabular focus:outline-2 focus:outline-[#0E5A6F]"
                      >
                        <option value="1">1명</option>
                        <option value="2">2명</option>
                        <option value="3">3명</option>
                        <option value="4">4명</option>
                        <option value="5~9">5~9명 (소그룹)</option>
                        <option value="10+">10명 이상 (단체)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="booking-note" className="block text-xs font-medium text-slate-700">
                      추가 요청 사항 (선택)
                    </label>
                    <textarea
                      id="booking-note"
                      rows={3}
                      value={form.note}
                      onChange={(e) => updateFormField('note', e.target.value)}
                      placeholder="잠수복 대여 사이즈, 어린이 동반 여부, 외국어 해설 요청 등을 남겨주세요."
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-[#0E5A6F] resize-none"
                    />
                  </div>

                  {formError && (
                    <p role="alert" className="text-xs font-medium text-red-700 leading-relaxed">
                      {formError}
                    </p>
                  )}

                  {submitSuccess && (
                    <div
                      role="status"
                      className="flex items-start gap-2.5 rounded-lg border border-[#0E5A6F]/25 bg-[#0E5A6F]/8 p-4 text-sm text-slate-800"
                    >
                      <CheckCircle2
                        className="w-5 h-5 text-[#0E5A6F] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          예약 문의가 정상적으로 접수되었습니다.
                        </p>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          물때와 기상 상황을 확인한 뒤 남겨주신 연락처로 회신드리겠습니다.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-[#0E5A6F] hover:bg-[#0b4859] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    )}
                    <span>{isSubmitting ? '접수 중...' : '예약 문의 메일 발송하기'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-editorial text-base font-bold text-slate-900">
              제주 해녀 아카이브
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              유네스코 인류무형문화유산 제주해녀문화 홍보 및 보존 아카이브 · 제주특별자치도
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
            <a href="#experience-3d" className="hover:text-[#0E5A6F] transition-colors">
              3D 해안 체험
            </a>
            <a href="#heritage" className="hover:text-[#0E5A6F] transition-colors">
              해녀의 유산
            </a>
            <a href="#equipment" className="hover:text-[#0E5A6F] transition-colors">
              물질 도구
            </a>
            <a href="#seasons" className="hover:text-[#0E5A6F] transition-colors">
              계절 바다
            </a>
            <a href="#visit" className="hover:text-[#0E5A6F] transition-colors">
              방문 안내
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
