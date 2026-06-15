import { CommonModule } from '@angular/common';
import { Component, ElementRef, AfterViewInit, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { RepositoryWorkspaceData, ServiceNode, DependencyLink, TrafficLevel } from '../../shared/models/repository-workspace.model';

@Component({
  selector: 'app-architecture-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './architecture-map.component.html',
  styleUrl: './architecture-map.component.scss'
})
export class ArchitectureMapComponent implements AfterViewInit {
  readonly data = input.required<RepositoryWorkspaceData>();
  readonly selectedDistrictId = input<string>('auth');
  readonly commandDistrictIds = input<string[]>([]);
  readonly commandRoadIds = input<string[]>([]);
  readonly reactionToken = input<number>(0);
  readonly reactionType = input<'push-code' | 'add-technical-debt' | 'add-tests' | 'refactor-service' | null>(null);
  readonly districtSelected = output<ServiceNode>();

  readonly hoveredDistrictId = signal<string | null>(null);
  readonly hoveredRoadId = signal<string | null>(null);
  readonly hasFocusInteraction = signal(false);
  readonly mapMode = signal<'2D' | '3D'>('2D');
  readonly mapViewportRef = viewChild<ElementRef<HTMLDivElement>>('mapViewport');
  readonly zoom = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly isDragging = signal(false);
  readonly particleSlots = [0, 1, 2];
  readonly isReacting = signal(false);
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  readonly mapTransform = computed(() => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`);

  constructor() {
    effect(() => {
      const commandIds = this.commandDistrictIds();
      const targetId = commandIds.length > 0 ? commandIds[0] : null;
      if (!targetId) {
        return;
      }
      const district = this.getDistrict(targetId);
      if (district && this.mapViewportRef()) {
        this.focusDistrict(district, true);
      }
    });

    effect(() => {
      this.reactionToken();
      const action = this.reactionType();
      if (!action) {
        return;
      }
      this.isReacting.set(true);
      setTimeout(() => this.isReacting.set(false), 720);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.resetView();
    }, 100);
  }

  private centerView(zoom: number): void {
    const viewport = this.mapViewportRef()?.nativeElement;
    if (!viewport) {
      return;
    }

    // Keep the map centered around the 50/50 city midpoint for any zoom level.
    const centeredX = viewport.clientWidth / 2 - (viewport.clientWidth * zoom) / 2;
    const centeredY = viewport.clientHeight / 2 - (viewport.clientHeight * zoom) / 2;
    this.panX.set(centeredX);
    this.panY.set(centeredY);
  }

  readonly hoveredDistrict = computed(() => {
    const hoveredId = this.hoveredDistrictId();
    if (!hoveredId) {
      return null;
    }
    return this.data().districts.find((district) => district.id === hoveredId) ?? null;
  });

  readonly hoveredRoad = computed(() => {
    const roadId = this.hoveredRoadId();
    if (!roadId) {
      return null;
    }
    return this.data().roads.find((road) => road.id === roadId) ?? null;
  });

  readonly focusedDistrictIds = computed(() => {
    const ids = new Set<string>();
    const selected = this.selectedDistrictId();
    ids.add(selected);

    this.data().roads.forEach((road) => {
      if (road.from === selected || road.to === selected) {
        ids.add(road.from);
        ids.add(road.to);
      }
    });

    const hoveredRoad = this.hoveredRoad();
    if (hoveredRoad) {
      ids.add(hoveredRoad.from);
      ids.add(hoveredRoad.to);
    }

    return ids;
  });

  readonly commandDistrictSet = computed(() => new Set(this.commandDistrictIds()));
  readonly commandRoadSet = computed(() => new Set(this.commandRoadIds()));

  selectDistrict(district: ServiceNode): void {
    this.hasFocusInteraction.set(true);
    this.districtSelected.emit(district);
    this.focusDistrict(district, true);
  }

  onDistrictDoubleClick(event: MouseEvent, district: ServiceNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectDistrict(district);
    this.focusDistrict(district, true);
  }

  setHoveredDistrict(id: string | null): void {
    this.hoveredDistrictId.set(id);
  }

  setMode(mode: '2D' | '3D'): void {
    this.mapMode.set(mode);
  }

  setHoveredRoad(id: string | null): void {
    this.hoveredRoadId.set(id);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const viewport = this.mapViewportRef()?.nativeElement;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const oldZoom = this.zoom();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    const nextZoom = this.clamp(oldZoom + delta, 0.2, 2.5);
    const ratio = nextZoom / oldZoom;

    this.panX.set(pointerX - (pointerX - this.panX()) * ratio);
    this.panY.set(pointerY - (pointerY - this.panY()) * ratio);
    this.zoom.set(nextZoom);
  }

  startPan(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.isDragging.set(true);
    this.dragOffsetX = event.clientX - this.panX();
    this.dragOffsetY = event.clientY - this.panY();
  }

  onPanMove(event: MouseEvent): void {
    if (!this.isDragging()) {
      return;
    }
    this.panX.set(event.clientX - this.dragOffsetX);
    this.panY.set(event.clientY - this.dragOffsetY);
  }

  endPan(): void {
    this.isDragging.set(false);
  }

  zoomIn(): void {
    this.zoom.set(this.clamp(this.zoom() + 0.14, 0.2, 2.5));
  }

  zoomOut(): void {
    this.zoom.set(this.clamp(this.zoom() - 0.14, 0.2, 2.5));
  }

  resetView(): void {
    this.zoom.set(1);
    this.centerView(1);
  }

  focusSelectedDistrict(): void {
    const district = this.getDistrict(this.selectedDistrictId());
    if (district) {
      this.focusDistrict(district, true);
    }
  }

  focusDistrict(district: ServiceNode, includeZoom: boolean): void {
    const viewport = this.mapViewportRef()?.nativeElement;
    if (!viewport) {
      return;
    }

    const nextZoom = includeZoom ? Math.max(this.zoom(), 1.35) : this.zoom();
    const pointX = (district.position.x / 100) * viewport.clientWidth;
    const pointY = (district.position.y / 100) * viewport.clientHeight;
    const centeredX = viewport.clientWidth / 2 - pointX * nextZoom;
    const centeredY = viewport.clientHeight / 2 - pointY * nextZoom;

    this.zoom.set(this.clamp(nextZoom, 0.2, 2.5));
    this.panX.set(centeredX);
    this.panY.set(centeredY);
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  getDistrict(id: string): ServiceNode | undefined {
    return this.data().districts.find((district) => district.id === id);
  }

  isRoadConnected(road: DependencyLink): boolean {
    const selectedId = this.selectedDistrictId();
    return road.from === selectedId || road.to === selectedId;
  }

  isRoadHighlighted(road: DependencyLink): boolean {
    const hoveredRoad = this.hoveredRoad();
    if (hoveredRoad) {
      return hoveredRoad.id === road.id;
    }
    if (this.commandRoadSet().size > 0) {
      return this.commandRoadSet().has(road.id);
    }
    return this.isRoadConnected(road);
  }

  shouldDimDistrict(district: ServiceNode): boolean {
    if (this.commandDistrictSet().size > 0) {
      return !this.commandDistrictSet().has(district.id);
    }
    if (!this.hasFocusInteraction()) {
      return false;
    }
    return !this.focusedDistrictIds().has(district.id);
  }

  shouldAnimateRoad(road: DependencyLink): boolean {
    if (this.commandRoadSet().size > 0) {
      return this.commandRoadSet().has(road.id);
    }
    return this.isRoadHighlighted(road);
  }

  shouldShowParticles(road: DependencyLink): boolean {
    return this.shouldAnimateRoad(road) && road.traffic !== 'None';
  }

  isCommandDistrict(district: ServiceNode): boolean {
    return this.commandDistrictSet().has(district.id);
  }

  isCommandRoad(road: DependencyLink): boolean {
    return this.commandRoadSet().has(road.id);
  }

  roadPulseDuration(traffic: TrafficLevel): string {
    if (traffic === 'High') {
      return '0.9s';
    }
    if (traffic === 'Medium') {
      return '1.35s';
    }
    if (traffic === 'Low') {
      return '1.9s';
    }
    return '2.4s';
  }

  roadParticleDuration(traffic: TrafficLevel): string {
    if (traffic === 'High') {
      return '1.15s';
    }
    if (traffic === 'Medium') {
      return '1.8s';
    }
    if (traffic === 'Low') {
      return '2.45s';
    }
    return '3s';
  }

  roadParticleDelay(slot: number, traffic: TrafficLevel): string {
    const spacing = traffic === 'High' ? 0.3 : traffic === 'Medium' ? 0.45 : 0.62;
    return `${slot * -spacing}s`;
  }

  roadParticleRadius(traffic: TrafficLevel): string {
    if (traffic === 'High') {
      return '0.42';
    }
    if (traffic === 'Medium') {
      return '0.36';
    }
    if (traffic === 'Low') {
      return '0.32';
    }
    return '0.28';
  }

  roadParticleColor(traffic: TrafficLevel): string {
    return this.roadColor(traffic);
  }

  roadTooltipLeft(road: DependencyLink): number {
    const from = this.getDistrict(road.from);
    const to = this.getDistrict(road.to);
    if (!from || !to) {
      return 50;
    }
    return (from.position.x + to.position.x) / 2;
  }

  roadTooltipTop(road: DependencyLink): number {
    const from = this.getDistrict(road.from);
    const to = this.getDistrict(road.to);
    if (!from || !to) {
      return 50;
    }
    return (from.position.y + to.position.y) / 2 - 4;
  }

  roadSourceName(road: DependencyLink): string {
    return this.getDistrict(road.from)?.name ?? road.from;
  }

  roadTargetName(road: DependencyLink): string {
    return this.getDistrict(road.to)?.name ?? road.to;
  }

  roadMotionPath(road: DependencyLink): string {
    const from = this.getDistrict(road.from);
    const to = this.getDistrict(road.to);
    if (!from || !to) {
      return 'M 50 50 L 50 50';
    }
    return `M ${from.position.x} ${from.position.y} L ${to.position.x} ${to.position.y}`;
  }

  riskLevel(district: ServiceNode): string {
    if (district.health < 45 || district.criticality > 38) {
      return 'High';
    }
    if (district.health < 65 || district.criticality > 28) {
      return 'Medium';
    }
    return 'Low';
  }

  roadColor(traffic: TrafficLevel): string {
    if (traffic === 'High') {
      return '#ef4444';
    }
    if (traffic === 'Medium') {
      return '#a855f7';
    }
    if (traffic === 'Low') {
      return '#4d7cfe';
    }
    return '#64748b';
  }

  districtGlow(traffic: TrafficLevel): string {
    if (traffic === 'High') {
      return '0 0 24px rgba(239,68,68,0.45)';
    }
    if (traffic === 'Medium') {
      return '0 0 24px rgba(168,85,247,0.45)';
    }
    if (traffic === 'Low') {
      return '0 0 24px rgba(77,124,254,0.45)';
    }
    return '0 0 18px rgba(148,163,184,0.35)';
  }

  districtShadow(district: ServiceNode): string {
    const isHovered = this.hoveredDistrictId() === district.id;
    const base = this.districtGlow(district.traffic);
    if (!isHovered) {
      return base;
    }

    if (district.traffic === 'High') {
      return '0 0 34px rgba(239,68,68,0.7)';
    }
    if (district.traffic === 'Medium') {
      return '0 0 34px rgba(168,85,247,0.7)';
    }
    if (district.traffic === 'Low') {
      return '0 0 34px rgba(77,124,254,0.7)';
    }
    return '0 0 28px rgba(148,163,184,0.62)';
  }

  isHighTrafficDistrict(district: ServiceNode): boolean {
    return district.traffic === 'High';
  }

  isHighRiskDistrict(district: ServiceNode): boolean {
    return district.health < 50 || district.criticality > 35;
  }
}
