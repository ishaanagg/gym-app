import type { Equipment, EquipmentCategory, Exercise } from '../types/gym';

export interface EquipmentArchetype {
  id: string;
  label: string;
  category: EquipmentCategory;
  defaultWeightsLbs: number[];
  keywords: string[];
  exercises: Omit<Exercise, 'id' | 'equipmentId'>[];
}

/**
 * Offline Coaching Knowledge Base: common apartment, condo, and hotel gym equipment
 * archetypes with pre-built functional exercises, movement planes, muscles, and safety cues.
 */
export const EQUIPMENT_ARCHETYPES: EquipmentArchetype[] = [
  {
    id: 'kettlebell',
    label: 'Kettlebells',
    category: 'free_weight',
    defaultWeightsLbs: [10, 15, 20, 25, 30, 35, 45, 53],
    keywords: ['kettlebell', 'kb'],
    exercises: [
      {
        name: 'Kettlebell Hip-Hinge Swing',
        block: 'strength',
        pattern: 'lower_hinge',
        plane: 'hinge',
        primaryMuscles: ['glutes', 'hamstrings'],
        repRange: [12, 16],
        visualKey: 'hinge',
        safetyCues: [
          'Snap hips back and drive glutes forward — arms act only as ropes.',
          'Keep lats packed and spine neutral from head to tailbone.',
          'Let the bell float to chest height without leaning backward.',
        ],
      },
      {
        name: 'Kettlebell Goblet Squat',
        block: 'strength',
        pattern: 'lower_squat',
        plane: 'squat',
        primaryMuscles: ['quads', 'glutes'],
        repRange: [8, 12],
        visualKey: 'squat',
        safetyCues: [
          'Hold the kettlebell by the horns close to your collarbone.',
          'Sit tall between your heels with knees tracking over mid-foot.',
          'Exhale and drive smoothly through your whole foot.',
        ],
      },
      {
        name: 'Single-Arm Kettlebell Overhead Press',
        block: 'strength',
        pattern: 'upper_push',
        plane: 'vertical_push',
        primaryMuscles: ['shoulders', 'triceps'],
        repRange: [8, 12],
        visualKey: 'overhead_press',
        safetyCues: [
          'Keep wrist straight with the bell resting softly on your forearm.',
          'Brace ribs and glutes to resist leaning sideways.',
          'Press smoothly to lockout with biceps near your ear.',
        ],
      },
    ],
  },
  {
    id: 'shoulder_press_machine',
    label: 'Shoulder Press Machine',
    category: 'machine',
    defaultWeightsLbs: [10, 20, 30, 45, 60, 75, 90, 105, 120],
    keywords: ['shoulder press', 'overhead press machine', 'deltoid'],
    exercises: [
      {
        name: 'Machine Shoulder Press',
        block: 'strength',
        pattern: 'upper_push',
        plane: 'vertical_push',
        primaryMuscles: ['shoulders', 'triceps'],
        repRange: [8, 12],
        visualKey: 'overhead_press',
        safetyCues: [
          'Set the seat so handles start right at shoulder level.',
          'Keep your upper and lower back resting gently against the pad.',
          'Press smoothly without shrugging your traps at the top.',
        ],
      },
    ],
  },
  {
    id: 'leg_extension',
    label: 'Leg Extension Machine',
    category: 'machine',
    defaultWeightsLbs: [15, 30, 45, 60, 75, 90, 105, 120, 135, 150],
    keywords: ['leg extension', 'quad extension'],
    exercises: [
      {
        name: 'Seated Leg Extension',
        block: 'strength',
        pattern: 'lower_squat',
        plane: 'squat',
        primaryMuscles: ['quads'],
        repRange: [10, 15],
        visualKey: 'squat',
        safetyCues: [
          'Align the machine pivot dot directly with your knee joint.',
          'Set the ankle pad just above your shoelaces and hold side handles.',
          'Pause 1 second at the top and lower under control.',
        ],
      },
    ],
  },
  {
    id: 'leg_curl',
    label: 'Seated / Lying Leg Curl',
    category: 'machine',
    defaultWeightsLbs: [15, 30, 45, 60, 75, 90, 105, 120, 135],
    keywords: ['leg curl', 'hamstring curl'],
    exercises: [
      {
        name: 'Machine Hamstring Curl',
        block: 'strength',
        pattern: 'lower_hinge',
        plane: 'hinge',
        primaryMuscles: ['hamstrings'],
        repRange: [10, 15],
        visualKey: 'hinge',
        safetyCues: [
          'Line up your knees with the machine hinge and flex ankles slightly.',
          'Keep hips pressed firmly into the pad throughout each rep.',
          'Control the eccentric return for 2 full seconds.',
        ],
      },
    ],
  },
  {
    id: 'assisted_pullup_dip',
    label: 'Assisted Pull-Up / Dip Station',
    category: 'machine',
    defaultWeightsLbs: [15, 30, 45, 60, 75, 90, 105],
    keywords: ['assisted pull', 'pull-up', 'pullup', 'dip machine', 'chin-up'],
    exercises: [
      {
        name: 'Assisted Pull-Up',
        block: 'strength',
        pattern: 'upper_pull',
        plane: 'vertical_pull',
        primaryMuscles: ['lats', 'biceps'],
        repRange: [6, 10],
        visualKey: 'lat_pulldown',
        safetyCues: [
          'Remember higher stack weight gives more assistance on this station.',
          'Initiate by pulling shoulder blades down before bending elbows.',
          'Lower smoothly to a comfortable overhead hang.',
        ],
      },
      {
        name: 'Assisted Parallel Bar Dip',
        block: 'strength',
        pattern: 'upper_push',
        plane: 'horizontal_push',
        primaryMuscles: ['chest', 'triceps'],
        repRange: [8, 12],
        visualKey: 'tricep_extension',
        safetyCues: [
          'Keep shoulders down away from your ears with a slight forward lean.',
          'Lower only until upper arms are roughly parallel to the floor.',
          'Press smoothly through your palms to full extension.',
        ],
      },
    ],
  },
  {
    id: 'pec_fly_rear_delt',
    label: 'Pec Fly / Rear Delt Machine',
    category: 'machine',
    defaultWeightsLbs: [15, 30, 45, 60, 75, 90, 105, 120],
    keywords: ['pec fly', 'pec deck', 'rear delt', 'chest fly'],
    exercises: [
      {
        name: 'Seated Machine Chest Fly',
        block: 'strength',
        pattern: 'upper_push',
        plane: 'horizontal_push',
        primaryMuscles: ['chest'],
        repRange: [10, 14],
        visualKey: 'chest_press',
        safetyCues: [
          'Keep a soft bend in your elbows as you sweep handles together.',
          'Stop the return when hands reach chest depth — avoid over-stretching shoulders.',
          'Keep shoulder blades anchored against the back pad.',
        ],
      },
      {
        name: 'Reverse Pec-Deck Rear Delt Fly',
        block: 'strength',
        pattern: 'upper_pull',
        plane: 'horizontal_pull',
        primaryMuscles: ['rear_delts', 'mid_back'],
        repRange: [12, 15],
        visualKey: 'seated_row',
        safetyCues: [
          'Face the pad with chest supported and arms at shoulder height.',
          'Sweep arms wide using the backs of your shoulders, not upper traps.',
          'Use controlled tempo without jerking the stack.',
        ],
      },
    ],
  },
  {
    id: 'smith_machine',
    label: 'Smith Machine',
    category: 'machine',
    defaultWeightsLbs: [25, 45, 65, 85, 95, 115, 135, 155, 185, 205, 225],
    keywords: ['smith'],
    exercises: [
      {
        name: 'Smith Machine Incline Press',
        block: 'strength',
        pattern: 'upper_push',
        plane: 'horizontal_push',
        primaryMuscles: ['chest', 'shoulders'],
        repRange: [8, 12],
        visualKey: 'chest_press',
        safetyCues: [
          'Set safety stops just below chest height before starting.',
          'Align bench so the bar lowers smoothly to upper chest.',
          'Rotate wrists cleanly to re-hook at the top of your final rep.',
        ],
      },
      {
        name: 'Smith Machine Split Squat',
        block: 'strength',
        pattern: 'lower_squat',
        plane: 'squat',
        primaryMuscles: ['quads', 'glutes'],
        repRange: [8, 12],
        visualKey: 'squat',
        safetyCues: [
          'Step your front foot slightly forward for a vertical shin angle.',
          'Lower straight down with torso upright and core braced.',
          'Drive up evenly through your front heel.',
        ],
      },
    ],
  },
  {
    id: 'barbell_rack',
    label: 'Barbell & Squat Rack',
    category: 'free_weight',
    defaultWeightsLbs: [45, 65, 85, 95, 115, 135, 155, 175, 185, 205, 225],
    keywords: ['barbell', 'squat rack', 'power rack', 'olympic bar'],
    exercises: [
      {
        name: 'Barbell Back Squat',
        block: 'strength',
        pattern: 'lower_squat',
        plane: 'squat',
        primaryMuscles: ['quads', 'glutes'],
        repRange: [6, 10],
        visualKey: 'squat',
        safetyCues: [
          'Set safety pins just below the bottom of your squat depth.',
          'Brace 360° around your midsection before descending.',
          'Keep chest proud and knees tracking in line with toes.',
        ],
      },
      {
        name: 'Barbell Romanian Deadlift',
        block: 'strength',
        pattern: 'lower_hinge',
        plane: 'hinge',
        primaryMuscles: ['hamstrings', 'glutes'],
        repRange: [8, 10],
        visualKey: 'hinge',
        safetyCues: [
          'Keep the bar lightly grazing your thighs with lats engaged.',
          'Push hips straight back until hamstrings reach a strong stretch.',
          'Stand tall by squeezing glutes without overarching your back.',
        ],
      },
    ],
  },
  {
    id: 'trx_suspension',
    label: 'TRX / Suspension Trainer',
    category: 'bodyweight',
    defaultWeightsLbs: [],
    keywords: ['trx', 'suspension', 'rings'],
    exercises: [
      {
        name: 'TRX Inverted Row',
        block: 'strength',
        pattern: 'upper_pull',
        plane: 'horizontal_pull',
        primaryMuscles: ['mid_back', 'biceps'],
        repRange: [10, 14],
        visualKey: 'seated_row',
        safetyCues: [
          'Keep your body in one straight plank line from ears to ankles.',
          'Walk feet closer to the anchor to increase challenge, back to lighten.',
          'Pull handles to your ribs and squeeze shoulder blades.',
        ],
      },
      {
        name: 'TRX Suspended Chest Press',
        block: 'strength',
        pattern: 'upper_push',
        plane: 'horizontal_push',
        primaryMuscles: ['chest', 'triceps'],
        repRange: [8, 12],
        visualKey: 'chest_press',
        safetyCues: [
          'Face away from the anchor with straps slightly above your forearms.',
          'Keep glutes and abs tight so your hips never sag.',
          'Lower under control and press handles together smoothly.',
        ],
      },
      {
        name: 'TRX Body Saw / Fallout',
        block: 'core',
        pattern: 'core',
        primaryMuscles: ['core'],
        repRange: [8, 12],
        visualKey: 'core_plank',
        safetyCues: [
          'Tuck your tailbone slightly to protect your lower back.',
          'Only reach arms forward as far as you can hold zero lumbar arch.',
          'Exhale forcefully as you pull back to center.',
        ],
      },
    ],
  },
  {
    id: 'resistance_bands',
    label: 'Resistance Bands',
    category: 'bodyweight',
    defaultWeightsLbs: [],
    keywords: ['band', 'elastic', 'theraband', 'loop band'],
    exercises: [
      {
        name: 'Band Pull-Aparts',
        block: 'strength',
        pattern: 'upper_pull',
        plane: 'horizontal_pull',
        primaryMuscles: ['rear_delts', 'mid_back'],
        repRange: [12, 18],
        visualKey: 'seated_row',
        safetyCues: [
          'Hold band at chest height with elbows straight but unlocked.',
          'Keep shoulders down as you stretch the band across your chest.',
          'Pause briefly when shoulder blades squeeze together.',
        ],
      },
      {
        name: 'Band Bicep Curls',
        block: 'strength',
        pattern: 'upper_isolation',
        primaryMuscles: ['biceps'],
        repRange: [12, 16],
        visualKey: 'arm_curl',
        safetyCues: [
          'Stand evenly on the center of the band with elbows tucked.',
          'Curl smoothly against rising band tension at the top.',
          'Resist the band all the way back down.',
        ],
      },
    ],
  },
  {
    id: 'arm_curl_machine',
    label: 'Preacher / Bicep Curl Machine',
    category: 'machine',
    defaultWeightsLbs: [10, 20, 30, 40, 50, 60, 70, 80],
    keywords: ['preacher', 'bicep machine', 'arm curl'],
    exercises: [
      {
        name: 'Machine Preacher Curl',
        block: 'strength',
        pattern: 'upper_isolation',
        primaryMuscles: ['biceps'],
        repRange: [10, 14],
        visualKey: 'arm_curl',
        safetyCues: [
          'Adjust seat so the backs of your upper arms rest flush on the pad.',
          'Stop just shy of hyperextending elbows at the bottom.',
          'Curl smoothly without lifting your elbows off the pad.',
        ],
      },
    ],
  },
  {
    id: 'rowing_machine',
    label: 'Rowing Machine (Erg)',
    category: 'cardio',
    defaultWeightsLbs: [],
    keywords: ['rower', 'rowing', 'concept2', 'erg', 'elliptical', 'stair'],
    exercises: [
      {
        name: 'Rowing Machine Steady Rhythm',
        block: 'cardio',
        pattern: 'cardio',
        repRange: [1, 1],
        durationSec: 300,
        isTimed: true,
        visualKey: 'seated_row',
        safetyCues: [
          'Set damper around 4–5 and sequence: Legs → Hips → Arms.',
          'Recover forward in reverse: Arms → Hips → Legs.',
          'Keep strokes smooth at 20–24 SPM with a tall spine.',
        ],
      },
    ],
  },
];

/**
 * Pure offline fuzzy matcher: recognizes common equipment names when the user adds a
 * machine manually (e.g., "LifeFitness Leg Curl", "Concept2 Rower", "Kettlebells").
 */
export function inferArchetypeFromName(name: string): EquipmentArchetype | undefined {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return undefined;

  for (const arch of EQUIPMENT_ARCHETYPES) {
    if (arch.label.toLowerCase() === normalized) return arch;
    if (arch.keywords.some((kw) => normalized.includes(kw))) {
      return arch;
    }
  }
  return undefined;
}

/**
 * Generates linked Exercise records for newly added equipment based on an explicit
 * archetype id or fuzzy name inference, skipping any names already linked to it.
 */
export function buildExercisesForEquipment(
  equipment: Equipment,
  existingExercises: Exercise[],
  explicitArchetypeId?: string
): Exercise[] {
  const archetype = explicitArchetypeId
    ? EQUIPMENT_ARCHETYPES.find((a) => a.id === explicitArchetypeId)
    : inferArchetypeFromName(equipment.name);

  if (!archetype) return [];

  const existingNames = new Set(
    existingExercises
      .filter((e) => e.equipmentId === equipment.id)
      .map((e) => e.name.toLowerCase())
  );

  return archetype.exercises
    .filter((tmpl) => !existingNames.has(tmpl.name.toLowerCase()))
    .map((tmpl, idx) => ({
      ...tmpl,
      id: `ex-auto-${equipment.id}-${idx + 1}`,
      equipmentId: equipment.id,
    }));
}
