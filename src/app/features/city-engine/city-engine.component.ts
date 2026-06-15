import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import * as THREE from 'three';
import { RepositoryWorkspaceData, ServiceNode, DependencyLink, TrafficLevel } from '../../shared/models/repository-workspace.model';

interface DistrictVisual {
  district: ServiceNode;
  mesh: THREE.Mesh;
  baseColor: THREE.Color;
  baseEmission: THREE.Color;
  height: number;
}

interface RoadVisual {
  road: DependencyLink;
  mesh: THREE.Mesh;
  path: THREE.CatmullRomCurve3;
}

interface Vehicle {
  mesh: THREE.Object3D;
  road: RoadVisual;
  speed: number;
  progress: number;
  active: boolean;
}

type VehicleType = 'car' | 'truck' | 'bus' | 'bike';

interface DistrictCard {
  id: string;
  name: string;
  subtitle: string;
  health: number;
  left: number;
  top: number;
  icon: string;
  selected: boolean;
}

@Component({
  selector: 'app-city-engine',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './city-engine.component.html',
  styleUrl: './city-engine.component.scss'
})
export class CityEngineComponent implements AfterViewInit, OnDestroy {
  readonly data = input.required<RepositoryWorkspaceData>();
  readonly selectedDistrictId = input<string>('auth');
  readonly commandDistrictIds = input<string[]>([]);
  readonly commandRoadIds = input<string[]>([]);
  readonly districtSelected = output<ServiceNode>();
  readonly districtDoubleSelected = output<ServiceNode>();

  readonly viewportRef = viewChild<ElementRef<HTMLDivElement>>('viewport');
  readonly isDayMode = signal(false);
  readonly hoveredDistrict = signal<ServiceNode | null>(null);
  readonly activeVehicleCount = signal(0);
  readonly districtCards = signal<DistrictCard[]>([]);
  readonly autoRotate = signal(false);
  readonly layersVisible = signal(true);

  private readonly districtById = computed(() => {
    const map = new Map<string, ServiceNode>();
    for (const district of this.data().districts) {
      map.set(district.id, district);
    }
    return map;
  });

  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private cityRoot = new THREE.Group();
  private roadsRoot = new THREE.Group();
  private buildingsRoot = new THREE.Group();
  private lightingRoot = new THREE.Group();
  private vehiclesRoot = new THREE.Group();
  private parksRoot = new THREE.Group();

  private districtVisuals: DistrictVisual[] = [];
  private roadVisuals: RoadVisual[] = [];
  private meshDistrictMap = new Map<THREE.Object3D, DistrictVisual>();

  private vehicles: Vehicle[] = [];
  private vehiclePool: Vehicle[] = [];
  private vehicleTrailSegments: THREE.Line[] = [];

  private frameId = 0;
  private destroy = false;
  private lastClickedDistrictId: string | null = null;
  private lastClickTime = 0;

  private ambientLight?: THREE.AmbientLight;
  private dirLight?: THREE.DirectionalLight;
  private hemiLight?: THREE.HemisphereLight;
  private cameraFocus = new THREE.Vector3(0, 0, 0);
  private cameraDesired = new THREE.Vector3(0, 38, 56);
  private cameraOrbitAngle = Math.PI * 0.2;
  private cameraOrbitRadius = 58;
  private cameraHeight = 36;

  constructor(private readonly zone: NgZone) {
    effect(() => {
      this.data();
      if (this.scene) {
        this.rebuildCity();
      }
    });

    effect(() => {
      const selected = this.selectedDistrictId();
      if (!selected || !this.camera || !this.scene) {
        return;
      }
      this.focusDistrict(selected);
      this.applySelectionGlow();
    });

    effect(() => {
      this.commandDistrictIds();
      this.commandRoadIds();
      this.applySelectionGlow();
    });

    effect(() => {
      this.updateLightingMode();
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.rebuildCity();
      this.startLoop();
      this.bindEvents();
    });
  }

  ngOnDestroy(): void {
    this.destroy = true;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    const viewport = this.viewportRef()?.nativeElement;
    if (viewport) {
      viewport.removeEventListener('pointermove', this.onPointerMove);
      viewport.removeEventListener('click', this.onClick);
      viewport.removeEventListener('dblclick', this.onDoubleClick);
      viewport.removeEventListener('mouseleave', this.onPointerLeave);
    }

    window.removeEventListener('resize', this.onResize);

    this.renderer?.dispose();
    this.scene?.clear();
  }

  setDayMode(isDay: boolean): void {
    this.isDayMode.set(isDay);
  }

  zoomIn(): void {
    this.cameraOrbitRadius = Math.max(24, this.cameraOrbitRadius - 6);
    this.updateDesiredCameraFromOrbit();
  }

  zoomOut(): void {
    this.cameraOrbitRadius = Math.min(110, this.cameraOrbitRadius + 6);
    this.updateDesiredCameraFromOrbit();
  }

  rotateCamera(): void {
    this.cameraOrbitAngle += Math.PI / 8;
    this.updateDesiredCameraFromOrbit();
  }

  resetView(): void {
    this.cameraFocus.set(0, 0, 0);
    this.cameraOrbitAngle = Math.PI * 0.2;
    this.cameraOrbitRadius = 58;
    this.cameraHeight = 36;
    this.updateDesiredCameraFromOrbit();
  }

  focusSelection(): void {
    this.focusDistrict(this.selectedDistrictId());
  }

  toggleLayers(): void {
    this.layersVisible.update((value) => !value);
    const visible = this.layersVisible();
    this.roadsRoot.visible = visible;
    this.vehiclesRoot.visible = visible;
    this.lightingRoot.visible = visible;
  }

  private initThree(): void {
    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport) {
      return;
    }

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x020617, 40, 180);

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 420);
    this.resetView();
    this.camera.position.copy(this.cameraDesired);
    this.camera.lookAt(this.cameraFocus);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    viewport.innerHTML = '';
    viewport.appendChild(this.renderer.domElement);

    this.scene.add(this.cityRoot);
    this.cityRoot.add(this.roadsRoot, this.parksRoot, this.buildingsRoot, this.lightingRoot, this.vehiclesRoot);

    this.createBaseEnvironment();
    this.prepareVehiclePool();
    this.updateLightingMode();
  }

  private createBaseEnvironment(): void {
    if (!this.scene) {
      return;
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x13213f, metalness: 0.14, roughness: 0.82, emissive: 0x040816, emissiveIntensity: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.cityRoot.add(ground);

    this.ambientLight = new THREE.AmbientLight(0xaec3ff, 0.95);
    this.dirLight = new THREE.DirectionalLight(0xe2f0ff, 1.2);
    this.dirLight.position.set(28, 42, 18);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.left = -80;
    this.dirLight.shadow.camera.right = 80;
    this.dirLight.shadow.camera.top = 80;
    this.dirLight.shadow.camera.bottom = -80;

    this.hemiLight = new THREE.HemisphereLight(0x9ac5ff, 0x111a2f, 0.6);

    this.scene.add(this.ambientLight, this.dirLight, this.hemiLight);
  }

  private rebuildCity(): void {
    this.clearGroup(this.roadsRoot);
    this.clearGroup(this.parksRoot);
    this.clearGroup(this.buildingsRoot);
    this.clearGroup(this.lightingRoot);

    this.districtVisuals = [];
    this.roadVisuals = [];
    this.meshDistrictMap.clear();

    const districts = this.data().districts;
    const roads = this.data().roads;

    for (const district of districts) {
      this.createDistrictEnvironment(district);
      this.createDistrictBuilding(district);
    }

    for (const road of roads) {
      this.createRoad(road);
    }

    this.spawnTrafficFromRoads();
    this.applySelectionGlow();
    this.updateDistrictCards();
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children.pop();
      if (!child) {
        break;
      }
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  private worldPosFromDistrict(district: ServiceNode): THREE.Vector3 {
    const x = (district.position.x - 50) * 1.12;
    const z = (district.position.y - 50) * 1.12;
    return new THREE.Vector3(x, 0, z);
  }

  private districtKind(district: ServiceNode): 'critical' | 'utility' | 'legacy' | 'unused' | 'medium' {
    const lowered = `${district.name} ${district.type} ${district.subtitle}`.toLowerCase();
    if (district.health < 45 || lowered.includes('legacy') || lowered.includes('industrial')) {
      return 'legacy';
    }
    if (district.traffic === 'None' || lowered.includes('ghost') || district.dependents <= 1) {
      return 'unused';
    }
    if (lowered.includes('utility') || lowered.includes('hub') || lowered.includes('infrastructure')) {
      return 'utility';
    }
    if (district.criticality > 36 || lowered.includes('auth') || lowered.includes('gateway') || lowered.includes('city hall')) {
      return 'critical';
    }
    return 'medium';
  }

  private createDistrictBuilding(district: ServiceNode): void {
    const pos = this.worldPosFromDistrict(district);
    const kind = this.districtKind(district);
    const height = this.computeBuildingHeight(district, kind);
    const { geometry, material } = this.createBuildingStyle(kind, district, height);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, height / 2, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData['districtId'] = district.id;

    this.buildingsRoot.add(mesh);

    const visual: DistrictVisual = {
      district,
      mesh,
      baseColor: (material as THREE.MeshStandardMaterial).color.clone(),
      baseEmission: (material as THREE.MeshStandardMaterial).emissive.clone(),
      height
    };

    this.districtVisuals.push(visual);
    this.meshDistrictMap.set(mesh, visual);

    this.addBuildingAccents(pos, kind, height, district);

    this.addStreetLights(pos, district);
    this.addTreesAndParks(pos, district);
  }

  private addBuildingAccents(
    pos: THREE.Vector3,
    kind: ReturnType<CityEngineComponent['districtKind']>,
    height: number,
    district: ServiceNode
  ): void {
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.72, 6.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, metalness: 0.18 })
    );
    podium.position.set(pos.x, 0.36, pos.z);
    podium.receiveShadow = true;
    this.buildingsRoot.add(podium);

    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(kind === 'critical' ? 2.4 : 1.8, 0.22, kind === 'critical' ? 2.4 : 1.8),
      new THREE.MeshStandardMaterial({
        color: kind === 'legacy' ? 0x7f1d1d : kind === 'critical' ? 0x93c5fd : 0x67e8f9,
        emissive: kind === 'legacy' ? 0x4c0519 : 0x1e3a8a,
        emissiveIntensity: kind === 'unused' ? 0.08 : 0.55,
        roughness: 0.48,
        metalness: 0.36
      })
    );
    crown.position.set(pos.x, Math.max(1, height) + 0.14, pos.z);
    this.buildingsRoot.add(crown);

    const spireHeight = kind === 'critical' ? 2.2 : kind === 'medium' ? 1.3 : 0.8;
    if (kind !== 'legacy' && kind !== 'unused') {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, spireHeight, 6),
        new THREE.MeshStandardMaterial({ color: 0xa5b4fc, emissive: 0x3730a3, emissiveIntensity: 0.6 })
      );
      spire.position.set(pos.x, height + spireHeight / 2 + 0.24, pos.z);
      this.buildingsRoot.add(spire);
    }

    if (district.health < 45 || kind === 'legacy') {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, transparent: true, opacity: 0.35, roughness: 1 })
      );
      smoke.position.set(pos.x + 0.7, height + 1.2, pos.z - 0.4);
      this.buildingsRoot.add(smoke);
    }
  }

  private computeBuildingHeight(district: ServiceNode, kind: ReturnType<CityEngineComponent['districtKind']>): number {
    const locScore = Math.min(1, district.linesOfCode / 18000);
    const depScore = Math.min(1, district.dependencies / 24);
    const usageScore = district.traffic === 'High' ? 1 : district.traffic === 'Medium' ? 0.7 : district.traffic === 'Low' ? 0.45 : 0.2;
    const base = 4 + locScore * 10 + depScore * 6 + usageScore * 8;

    if (kind === 'critical') {
      return base + 14;
    }
    if (kind === 'utility') {
      return base + 5;
    }
    if (kind === 'legacy') {
      return Math.max(6, base - 2);
    }
    if (kind === 'unused') {
      return Math.max(4, base - 5);
    }
    return base + 8;
  }

  private createBuildingStyle(kind: ReturnType<CityEngineComponent['districtKind']>, district: ServiceNode, height: number): {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
  } {
    if (kind === 'utility') {
      const geometry = new THREE.CylinderGeometry(2.2, 2.7, Math.max(5, height * 0.72), 8, 1);
      const material = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.56, roughness: 0.32, emissive: 0x0c4a6e, emissiveIntensity: 0.5 });
      return { geometry, material };
    }

    if (kind === 'legacy') {
      const geometry = new THREE.BoxGeometry(4.8, Math.max(5, height * 0.78), 4.8);
      const material = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.24, roughness: 0.68, emissive: 0x7f1d1d, emissiveIntensity: 0.42 });
      return { geometry, material };
    }

    if (kind === 'unused') {
      const geometry = new THREE.BoxGeometry(4, Math.max(4, height * 0.55), 4);
      const material = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.1, roughness: 0.82, emissive: 0x1e293b, emissiveIntensity: 0.22 });
      return { geometry, material };
    }

    if (kind === 'critical') {
      const geometry = new THREE.BoxGeometry(5.6, height, 5.6, 1, 1, 1);
      const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.42, roughness: 0.28, emissive: 0x1d4ed8, emissiveIntensity: 0.75 });
      return { geometry, material };
    }

    const geometry = new THREE.BoxGeometry(4.9, height * 0.82, 4.9, 1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: district.health > 70 ? 0x22d3ee : 0x8b5cf6,
      metalness: 0.3,
      roughness: 0.34,
      emissive: district.health > 70 ? 0x155e75 : 0x581c87,
      emissiveIntensity: 0.55
    });
    return { geometry, material };
  }

  private createDistrictEnvironment(district: ServiceNode): void {
    const pos = this.worldPosFromDistrict(district);

    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95, metalness: 0.05 })
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(pos.x, 0.05, pos.z);
    sidewalk.receiveShadow = true;
    this.parksRoot.add(sidewalk);
  }

  private createRoad(road: DependencyLink): void {
    const from = this.districtById().get(road.from);
    const to = this.districtById().get(road.to);
    if (!from || !to) {
      return;
    }

    const start = this.worldPosFromDistrict(from);
    const end = this.worldPosFromDistrict(to);

    const mid = new THREE.Vector3((start.x + end.x) / 2, 0.03, (start.z + end.z) / 2);
    const dir = end.clone().sub(start);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const bend = Math.min(6, dir.length() * 0.14);
    const control = mid.add(perp.multiplyScalar(bend));

    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(start.x, 0.02, start.z),
      control,
      new THREE.Vector3(end.x, 0.02, end.z)
    ]);

    const width = road.traffic === 'High' ? 1.45 : road.traffic === 'Medium' ? 1.1 : road.traffic === 'Low' ? 0.85 : 0.6;
    const tube = new THREE.TubeGeometry(path, 30, width, 8, false);
    const color = road.traffic === 'High' ? 0xef4444 : road.traffic === 'Medium' ? 0xa855f7 : road.traffic === 'Low' ? 0x3b82f6 : 0x64748b;

    const mesh = new THREE.Mesh(
      tube,
      new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.18, emissive: color, emissiveIntensity: 0.22 })
    );
    mesh.receiveShadow = true;
    mesh.userData['roadId'] = road.id;

    this.roadsRoot.add(mesh);

    const glowTube = new THREE.TubeGeometry(path, 30, Math.max(0.16, width * 0.2), 8, false);
    const glow = new THREE.Mesh(
      glowTube,
      new THREE.MeshStandardMaterial({
        color: road.traffic === 'High' ? 0xfb7185 : road.traffic === 'Medium' ? 0xa78bfa : road.traffic === 'Low' ? 0x60a5fa : 0x64748b,
        emissive: road.traffic === 'High' ? 0x9f1239 : road.traffic === 'Medium' ? 0x5b21b6 : 0x1d4ed8,
        emissiveIntensity: road.traffic === 'None' ? 0.12 : road.traffic === 'High' ? 1.8 : 1.35,
        transparent: true,
        opacity: road.traffic === 'None' ? 0.55 : 0.9,
        roughness: 0.3,
        metalness: 0.2
      })
    );
    glow.position.y += 0.045;
    this.roadsRoot.add(glow);

    const stripeTube = new THREE.TubeGeometry(path, 30, Math.max(0.04, width * 0.06), 6, false);
    const stripe = new THREE.Mesh(
      stripeTube,
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0x334155,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.78
      })
    );
    stripe.position.y += 0.065;
    this.roadsRoot.add(stripe);

    this.roadVisuals.push({ road, mesh, path });
  }

  private addStreetLights(pos: THREE.Vector3, district: ServiceNode): void {
    const offsets = [
      new THREE.Vector3(5.6, 0, 5.6),
      new THREE.Vector3(-5.6, 0, 5.6),
      new THREE.Vector3(5.6, 0, -5.6),
      new THREE.Vector3(-5.6, 0, -5.6)
    ];

    for (const offset of offsets) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.26 })
      );
      pole.position.copy(pos.clone().add(offset).add(new THREE.Vector3(0, 1.2, 0)));
      pole.castShadow = true;
      this.lightingRoot.add(pole);

      const bulbColor = district.health >= 65 ? 0xfef9c3 : district.health >= 45 ? 0xfb923c : 0xf87171;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({ color: bulbColor, emissive: bulbColor, emissiveIntensity: district.health >= 65 ? 1.4 : 0.9 })
      );
      bulb.position.copy(pole.position.clone().add(new THREE.Vector3(0, 1.26, 0)));
      this.lightingRoot.add(bulb);
    }
  }

  private addTreesAndParks(pos: THREE.Vector3, district: ServiceNode): void {
    const treeCount = district.health > 70 ? 5 : district.health > 50 ? 3 : 1;
    const baseColor = district.health > 70 ? 0x22c55e : 0x4ade80;

    for (let i = 0; i < treeCount; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(treeCount, 1);
      const r = 6 + (i % 2) * 1.8;
      const x = pos.x + Math.cos(angle) * r;
      const z = pos.z + Math.sin(angle) * r;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 1, 6),
        new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 })
      );
      trunk.position.set(x, 0.5, z);

      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 8, 8),
        new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9 })
      );
      leaf.position.set(x, 1.34, z);

      this.parksRoot.add(trunk, leaf);
    }
  }

  private prepareVehiclePool(): void {
    const maxPool = 560;
    for (let i = 0; i < maxPool; i += 1) {
      const type = i % 4 === 0 ? 'truck' : i % 5 === 0 ? 'bus' : i % 3 === 0 ? 'bike' : 'car';
      const mesh = this.createVehicleMesh(type);
      mesh.visible = false;
      this.vehiclesRoot.add(mesh);

      this.vehiclePool.push({
        mesh,
        road: { road: { id: '', from: '', to: '', traffic: 'Low', trafficCount: 0 }, mesh: new THREE.Mesh(), path: new THREE.CatmullRomCurve3() },
        speed: 0,
        progress: 0,
        active: false
      });
    }
  }

  private createVehicleMesh(type: VehicleType): THREE.Object3D {
    const g = new THREE.Group();

    const bodySize = type === 'bus' ? [0.6, 0.26, 1.2] : type === 'truck' ? [0.56, 0.28, 0.95] : type === 'bike' ? [0.2, 0.13, 0.44] : [0.42, 0.2, 0.72];
    const bodyColor = type === 'bus' ? 0x22d3ee : type === 'truck' ? 0xf97316 : type === 'bike' ? 0x22c55e : 0x60a5fa;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bodySize[0], bodySize[1], bodySize[2]),
      new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.34, roughness: 0.28, emissive: bodyColor, emissiveIntensity: 0.18 })
    );
    body.castShadow = true;
    body.position.y = 0.18;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfde68a, emissiveIntensity: 1.75 })
    );
    head.position.set(0, 0.2, bodySize[2] * 0.48);
    g.add(head);

    const tail = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xef4444, emissiveIntensity: 1.6 })
    );
    tail.position.set(0, 0.2, -bodySize[2] * 0.48);
    g.add(tail);

    return g;
  }

  private spawnTrafficFromRoads(): void {
    for (const vehicle of this.vehicles) {
      vehicle.active = false;
      vehicle.mesh.visible = false;
      this.vehiclePool.push(vehicle);
    }
    this.vehicles = [];

    const targetCount = this.roadVisuals.reduce((sum, rv) => {
      if (rv.road.traffic === 'High') {
        return sum + 16;
      }
      if (rv.road.traffic === 'Medium') {
        return sum + 9;
      }
      if (rv.road.traffic === 'Low') {
        return sum + 4;
      }
      return sum + 1;
    }, 0);

    const capped = Math.min(500, targetCount);

    let allocated = 0;
    for (const rv of this.roadVisuals) {
      if (allocated >= capped) {
        break;
      }

      const perRoad = rv.road.traffic === 'High' ? 16 : rv.road.traffic === 'Medium' ? 9 : rv.road.traffic === 'Low' ? 4 : 1;
      const toSpawn = Math.min(perRoad, capped - allocated);

      for (let i = 0; i < toSpawn; i += 1) {
        const vehicle = this.vehiclePool.pop();
        if (!vehicle) {
          break;
        }

        vehicle.road = rv;
        vehicle.speed = (rv.road.traffic === 'High' ? 0.14 : rv.road.traffic === 'Medium' ? 0.1 : 0.072) * (0.8 + Math.random() * 0.5);
        vehicle.progress = Math.random();
        vehicle.active = true;
        vehicle.mesh.visible = rv.road.traffic !== 'None';

        this.vehicles.push(vehicle);
        allocated += 1;
      }
    }

    this.activeVehicleCount.set(this.vehicles.length);
  }

  private applySelectionGlow(): void {
    const selectedId = this.selectedDistrictId();
    const commandSet = new Set(this.commandDistrictIds());

    for (const visual of this.districtVisuals) {
      const material = visual.mesh.material as THREE.MeshStandardMaterial;
      const district = visual.district;

      let emissiveIntensity = district.health > 70 ? 0.35 : district.health > 45 ? 0.2 : 0.08;
      let targetColor = visual.baseColor.clone();

      if (district.id === selectedId) {
        emissiveIntensity = 0.95;
        targetColor = new THREE.Color(0x60a5fa);
      } else if (commandSet.has(district.id)) {
        emissiveIntensity = 0.65;
        targetColor = new THREE.Color(0x818cf8);
      } else if (district.health < 45) {
        targetColor = new THREE.Color(0x52525b);
      }

      material.color.lerp(targetColor, 0.35);
      material.emissive.copy(visual.baseEmission);
      material.emissiveIntensity = emissiveIntensity;
    }
  }

  private updateLightingMode(): void {
    if (!this.scene || !this.ambientLight || !this.dirLight || !this.hemiLight) {
      return;
    }

    if (this.isDayMode()) {
      this.scene.fog = new THREE.Fog(0xe2e8f0, 90, 240);
      this.ambientLight.color.set(0xffffff);
      this.ambientLight.intensity = 1.15;
      this.dirLight.color.set(0xfff7d6);
      this.dirLight.intensity = 1.4;
      this.hemiLight.intensity = 0.85;
      if (this.renderer) {
        this.renderer.toneMappingExposure = 1.35;
      }
    } else {
      this.scene.fog = new THREE.Fog(0x0a1024, 70, 220);
      this.ambientLight.color.set(0xa5b4fc);
      this.ambientLight.intensity = 1.0;
      this.dirLight.color.set(0xbfdbfe);
      this.dirLight.intensity = 1.25;
      this.hemiLight.intensity = 0.78;
      if (this.renderer) {
        this.renderer.toneMappingExposure = 1.75;
      }
    }
  }

  private focusDistrict(id: string): void {
    const visual = this.districtVisuals.find((d) => d.district.id === id);
    if (!visual) {
      return;
    }

    const p = visual.mesh.position;
    this.cameraFocus.set(p.x, 0, p.z);
    this.updateDesiredCameraFromOrbit();
  }

  private updateDesiredCameraFromOrbit(): void {
    const offsetX = Math.cos(this.cameraOrbitAngle) * this.cameraOrbitRadius;
    const offsetZ = Math.sin(this.cameraOrbitAngle) * this.cameraOrbitRadius;
    this.cameraDesired.set(this.cameraFocus.x + offsetX, this.cameraHeight, this.cameraFocus.z + offsetZ);
  }

  private startLoop(): void {
    const loop = () => {
      if (this.destroy) {
        return;
      }

      const delta = this.clock.getDelta();
      this.updateTraffic(delta);
      this.updateCamera(delta);
      this.updateDistrictCards();
      this.renderer?.render(this.scene!, this.camera!);
      this.frameId = requestAnimationFrame(loop);
    };

    this.frameId = requestAnimationFrame(loop);
  }

  private updateCamera(delta: number): void {
    if (!this.camera) {
      return;
    }

    if (this.autoRotate()) {
      this.cameraOrbitAngle += delta * 0.22;
      this.updateDesiredCameraFromOrbit();
    }

    this.camera.position.lerp(this.cameraDesired, Math.min(1, delta * 3.2));
    this.camera.lookAt(this.cameraFocus);
  }

  private updateDistrictCards(): void {
    if (!this.camera || !this.renderer) {
      return;
    }

    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    const selectedId = this.selectedDistrictId();
    const prioritized = [...this.districtVisuals]
      .sort((a, b) => b.district.criticality - a.district.criticality)
      .slice(0, 14);

    const cards: DistrictCard[] = [];
    for (const visual of prioritized) {
      const world = new THREE.Vector3(visual.mesh.position.x, visual.height + 1.6, visual.mesh.position.z);
      const projected = world.project(this.camera);

      if (projected.z < -1 || projected.z > 1) {
        continue;
      }

      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      if (x < -120 || x > width + 120 || y < -80 || y > height + 80) {
        continue;
      }

      cards.push({
        id: visual.district.id,
        name: visual.district.name,
        subtitle: visual.district.subtitle,
        health: visual.district.health,
        left: x,
        top: y,
        icon: visual.district.icon,
        selected: visual.district.id === selectedId
      });
    }

    this.zone.run(() => this.districtCards.set(cards));
  }

  private updateTraffic(delta: number): void {
    for (const vehicle of this.vehicles) {
      if (!vehicle.active || !vehicle.mesh.visible) {
        continue;
      }

      vehicle.progress += vehicle.speed * delta;
      if (vehicle.progress > 1) {
        vehicle.progress -= 1;
      }

      const pos = vehicle.road.path.getPointAt(vehicle.progress);
      const tangent = vehicle.road.path.getTangentAt(vehicle.progress).normalize();

      vehicle.mesh.position.set(pos.x, 0.2, pos.z);
      const yaw = Math.atan2(tangent.x, tangent.z);
      vehicle.mesh.rotation.set(0, yaw, 0);

      this.updateMotionTrail(vehicle);
    }
  }

  private updateMotionTrail(vehicle: Vehicle): void {
    const front = vehicle.mesh.position.clone();
    const back = front.clone().add(new THREE.Vector3(0, 0, -0.65).applyEuler(vehicle.mesh.rotation));

    if (!vehicle.mesh.userData['trail']) {
      const geometry = new THREE.BufferGeometry().setFromPoints([front, back]);
      const material = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.35 });
      const line = new THREE.Line(geometry, material);
      this.vehiclesRoot.add(line);
      vehicle.mesh.userData['trail'] = line;
      this.vehicleTrailSegments.push(line);
      return;
    }

    const line = vehicle.mesh.userData['trail'] as THREE.Line;
    (line.geometry as THREE.BufferGeometry).setFromPoints([front, back]);
  }

  private bindEvents(): void {
    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport) {
      return;
    }

    viewport.addEventListener('pointermove', this.onPointerMove);
    viewport.addEventListener('click', this.onClick);
    viewport.addEventListener('dblclick', this.onDoubleClick);
    viewport.addEventListener('mouseleave', this.onPointerLeave);
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (!this.renderer || !this.camera) {
      return;
    }

    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport) {
      return;
    }

    this.camera.aspect = viewport.clientWidth / viewport.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport || !this.camera || !this.scene) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.buildingsRoot.children, false);

    if (intersects.length === 0) {
      this.zone.run(() => this.hoveredDistrict.set(null));
      return;
    }

    const hit = intersects[0].object;
    const visual = this.meshDistrictMap.get(hit);
    if (!visual) {
      this.zone.run(() => this.hoveredDistrict.set(null));
      return;
    }

    this.zone.run(() => this.hoveredDistrict.set(visual.district));
  };

  private onPointerLeave = (): void => {
    this.zone.run(() => this.hoveredDistrict.set(null));
  };

  private onClick = (): void => {
    const hovered = this.hoveredDistrict();
    if (!hovered) {
      return;
    }

    const now = performance.now();
    if (this.lastClickedDistrictId === hovered.id && now - this.lastClickTime < 280) {
      return;
    }

    this.lastClickedDistrictId = hovered.id;
    this.lastClickTime = now;
    this.zone.run(() => this.districtSelected.emit(hovered));
  };

  private onDoubleClick = (): void => {
    const hovered = this.hoveredDistrict();
    if (!hovered) {
      return;
    }

    this.zone.run(() => this.districtDoubleSelected.emit(hovered));
  };
}
