/* ===== 数值与定义 ===== */
(function (CM) {
  'use strict';

  CM.TW = 64;            // 地块宽（等距菱形）
  CM.TH = 32;            // 地块高
  CM.DAY_SECONDS = 300;  // 1× 速度下，一个游戏日 = 300 秒（5 分钟）
  CM.DAYS_PER_MONTH = 30;
  CM.MONTHS_PER_YEAR = 12;
  CM.SPEEDS = [0, 1, 2, 4, 8, 16, 32, 64, 128];

  CM.MAP_MIN = 24;
  CM.MAP_MAX = 64;

  /* ---------- 地形 ---------- */
  /* sea=海洋，不可开垦、不可建造，只能填海造陆；
     beach=岛缘沙滩，开垦便宜；reclaimed=填海所得的新陆地，可直接建设 */
  CM.TERRAIN = {
    grass:     { name: '草地',   color: '#679a40', clearCost: 220, land: true,
                 desc: '开阔的天然草场，最容易开垦。' },
    forest:    { name: '林地',   color: '#3f6b30', clearCost: 620, land: true,
                 desc: '成片林木。开垦费更高，砍伐会降低绿地率。' },
    hill:      { name: '缓丘',   color: '#8a9160', clearCost: 880, land: true,
                 desc: '起伏的土丘，需要平整，造价最高。' },
    beach:     { name: '沙滩',   color: '#e3d3a2', clearCost: 180, land: true,
                 desc: '海岸沙滩，开垦便宜；适合做滨海公园与住宅，地价有加成。' },
    reclaimed: { name: '填海地', color: '#c2bda8', clearCost: 0,   land: true,
                 desc: '刚填出来的新陆地，已经平整，可以直接建设。' },
    sea:       { name: '海洋',   color: '#2b6f9c', clearCost: 0,   land: false,
                 desc: '海域。不能开垦或建造，只能填海造陆（必须与已有陆地相邻）。' }
  };

  /* ---------- 填海造陆 ---------- */
  CM.RECLAIM = {
    base: 800,        // 紧邻陆地（深度 0）的造价
    perDepth: 700,    // 每深一格加价
    maxDepth: 6,      // 计价封顶深度
    refund: 0
  };


  /* ---------- 区划 ---------- */
  CM.ZONES = {
    R: { key: 'R', name: '住宅区', color: '#5fd98a', letter: '住', desc: '住宅区。开发商按地价与需求自建：低层住宅楼 → 多层公寓 → 高层住宅。' },
    C: { key: 'C', name: '商业区', color: '#4fb0f0', letter: '商', desc: '商业区。按人流与地价自建：临街商铺 → 小型超市 → 大型综合体。' },
    I: { key: 'I', name: '工业区', color: '#f2b95c', letter: '工', desc: '工业区。按需求自建：小型工厂 → 物流仓库 → 重工业园区，污染随之上升。' }
  };

  /* ---------- 私营建筑（玩家只划区，开发商自建） ---------- */
  /* level: 1 低 2 中 3 高；cap=居住容量；jobs=岗位；pol=污染 */
  CM.RES = {
    R1: { key: 'R1', name: '低层住宅楼', zone: 'R', level: 1, h: 18, cap: 12, color: '#e6d2b4', roof: '#b4583f', style: 'house',
          desc: '3～4 层的砖混住宅，住 12 户。' },
    R2: { key: 'R2', name: '多层公寓',   zone: 'R', level: 2, h: 34, cap: 36, color: '#e9e1cf', roof: '#8f8371', style: 'walkup',
          desc: '7～9 层带电梯的公寓，住 36 户。' },
    R3: { key: 'R3', name: '高层住宅',   zone: 'R', level: 3, h: 58, cap: 90, color: '#dfe6ea', roof: '#8aa0ae', style: 'tower',
          desc: '20 层以上的高层，住 90 户，需要好地段。' },
    C1: { key: 'C1', name: '临街商铺',   zone: 'C', level: 1, h: 16, jobs: 7,  color: '#87c0d8', style: 'shop',
          desc: '沿街两层小店面，提供 7 个岗位。' },
    C2: { key: 'C2', name: '小型超市',   zone: 'C', level: 2, h: 22, jobs: 18, color: '#9ec9d8', style: 'supermarket',
          desc: '带停车位的社区超市，18 个岗位。' },
    C3: { key: 'C3', name: '大型综合体', zone: 'C', level: 3, h: 50, jobs: 48, color: '#a9c8da', style: 'mall',
          desc: '商场＋写字楼，48 个岗位，显著抬高周边地价。' },
    I1: { key: 'I1', name: '小型工厂',   zone: 'I', level: 1, h: 16, jobs: 14, pol: 6,  color: '#b3a58e', style: 'factory',
          desc: '机械加工小厂，14 个岗位，有烟尘。' },
    I2: { key: 'I2', name: '物流仓库',   zone: 'I', level: 2, h: 14, jobs: 24, pol: 3,  color: '#b0a190', style: 'warehouse',
          desc: '仓储与分拣中心，24 个岗位，污染不大但货车多。' },
    I3: { key: 'I3', name: '重工业园区', zone: 'I', level: 3, h: 24, jobs: 52, pol: 18, color: '#a4967f', style: 'factory2',
          desc: '冶炼与化工，52 个岗位，污染很重。' }
  };

  CM.ZONE_LEVELS = { R: ['R1', 'R2', 'R3'], C: ['C1', 'C2', 'C3'], I: ['I1', 'I2', 'I3'] };

  /* ---------- 公共设施（玩家直接建造） ---------- */
  CM.PUB = {
    wind:       { key: 'wind',       name: '风力发电机', cost: 6000,  upkeep: 90,  radius: 5, h: 26, svc: 'power', color: '#d7dee2', style: 'wind',
                  desc: '小型风机，便宜、安静，供电半径 5 格。' },
    power:      { key: 'power',      name: '燃气发电厂', cost: 18000, upkeep: 260, radius: 8, h: 23, svc: 'power', color: '#c8a24f', style: 'power',
                  desc: '稳定的大功率电源，供电半径 8 格，有烟。' },
    waterSmall: { key: 'waterSmall', name: '小型水站',   cost: 5000,  upkeep: 90,  radius: 5, h: 15, svc: 'water', color: '#6fa3c4', style: 'waterSmall',
                  desc: '地下水站，供水半径 5 格。' },
    water:      { key: 'water',      name: '自来水厂',   cost: 12000, upkeep: 220, radius: 8, h: 17, svc: 'water', color: '#5f97bb', style: 'water',
                  desc: '集中供水，半径 8 格。' },
    police:     { key: 'police',     name: '派出所',     cost: 8000,  upkeep: 120, radius: 4, h: 16, svc: 'police', color: '#e2e6ea', style: 'police',
                  desc: '治安覆盖半径 4 格。' },
    fire:       { key: 'fire',       name: '消防站',     cost: 8000,  upkeep: 120, radius: 4, h: 16, svc: 'fire',   color: '#e9e3dc', style: 'fire',
                  desc: '消防覆盖半径 4 格。' },
    school:     { key: 'school',     name: '小学',       cost: 12000, upkeep: 200, radius: 5, h: 16, svc: 'school', color: '#d8c89a', style: 'school',
                  desc: '教育覆盖半径 5 格。' },
    school2:    { key: 'school2',    name: '中学',       cost: 22000, upkeep: 340, radius: 7, h: 20, svc: 'school', color: '#c9b06a', style: 'school2',
                  desc: '教育覆盖半径 7 格，比小学更强。' },
    clinic:     { key: 'clinic',     name: '社区诊所',   cost: 9000,  upkeep: 160, radius: 4, h: 14, svc: 'health', color: '#eef1f3', style: 'clinic',
                  desc: '医疗覆盖半径 4 格。' },
    hospital:   { key: 'hospital',   name: '综合医院',   cost: 26000, upkeep: 420, radius: 7, h: 25, svc: 'health', color: '#d8dde2', style: 'hospital',
                  desc: '医疗覆盖半径 7 格，人口多时必需。' },
    park:       { key: 'park',       name: '街心公园',   cost: 3000,  upkeep: 40,  radius: 4, h: 2,  svc: 'park',   color: '#6fb463', style: 'park',
                  desc: '绿地半径 4 格，吸附污染、提升地价。' },
    park2:      { key: 'park2',      name: '中央公园',   cost: 9000,  upkeep: 100, radius: 7, h: 2,  svc: 'park',   color: '#5da355', style: 'park2',
                  desc: '大片绿地与水景，半径 7 格，周边地价明显上涨。' },
    wasteSmall: { key: 'wasteSmall', name: '垃圾转运站', cost: 8000,  upkeep: 160, radius: 5, h: 12, svc: 'waste', color: '#8f959b', style: 'wasteSmall',
                  desc: '环卫覆盖半径 5 格。' },
    waste:      { key: 'waste',      name: '垃圾处理厂', cost: 16000, upkeep: 280, radius: 7, h: 17, svc: 'waste', color: '#8a8f96', style: 'waste',
                  desc: '环卫覆盖半径 7 格。' },
    cityhall:   { key: 'cityhall',   name: '市政厅',     cost: 0,     upkeep: 0,   radius: 0, h: 28, svc: null, color: '#ddd6c6', style: 'cityhall',
                  desc: '市政府所在地，道路网络的根。不可拆除。' }
  };

  CM.PUB_GROUPS = [
    { name: '能源与供水', items: ['wind', 'power', 'waterSmall', 'water'] },
    { name: '治安与消防', items: ['police', 'fire'] },
    { name: '教育与医疗', items: ['school', 'school2', 'clinic', 'hospital'] },
    { name: '环境与环卫', items: ['park', 'park2', 'wasteSmall', 'waste'] }
  ];

  CM.SVC = {
    water: '供水', power: '供电', police: '治安', fire: '消防',
    school: '教育', health: '医疗', park: '绿地', waste: '环卫'
  };

  /* ---------- 建造价格 ---------- */
  CM.COST = {
    road: 400, roadUpkeep: 5, zone: 40,
    clearSurcharge: 1.35,
    refund: 0.4
  };

  /* ---------- 数据图层 ---------- */
  CM.LAYERS = [
    { key: 'none',      name: '无' },
    { key: 'service',   name: '服务覆盖' },
    { key: 'pollution', name: '污染' },
    { key: 'value',     name: '地价' },
    { key: 'road',      name: '道路连通' }
  ];

  /* ---------- 教程 ---------- */
  CM.TUTORIAL = [
    { key: 'clear', text: '用左栏「<em>开荒</em>」清出至少 3 块地' },
    { key: 'road',  text: '用「<em>道路</em>」把地块连到<em>市政厅</em>' },
    { key: 'zone',  text: '划一片「<em>住宅区</em>」，开发商自己会盖楼' },
    { key: 'util',  text: '建<em>小型水站</em>与<em>风力发电机</em>，没有水电房子不会有人住' },
    { key: 'jobs',  text: '划一片「<em>商业区</em>」：居民要有工作，城市才有税收' },
    { key: 'layer', text: '点底部「<em>服务覆盖</em>」图层，检查哪里还有缺口' }
  ];

  /* ---------- 模式 ---------- */
  CM.MODE = {
    manage: {
      key: 'manage', name: '经营模式', tag: '财政有限',
      money: 0,          // 由地图面积计算，见 startMoney()
      desc: '预算有限，钱要算着花。政府的钱来自税收，赤字时不能动工。'
    },
    sandbox: {
      key: 'sandbox', name: '沙盒模式', tag: '资金无限',
      money: 1000000000,
      desc: '资金无限，随便造。市民仍会因失业和服务不足而不满。'
    }
  };

  CM.startMoney = function (W, H) {
    return Math.round(100000 + W * H * 250);
  };

  CM.isPublic = function (k) { return !!CM.PUB[k]; };
  CM.defOf = function (k) { return CM.RES[k] || CM.PUB[k] || null; };

})(window.CM);
