// イージス・システム 簡易シミュレーター

// ターゲット（敵ミサイル・航空機）クラス
class Target {
    constructor(id, rangeKm, speedKmh) {
        this.id = id;
        this.range = rangeKm; // 艦船からの距離 (km)
        this.speed = speedKmh; // 速度 (km/h)
        this.speedPerSec = speedKmh / 3600; // 1秒あたりの移動距離 (km)
        this.threatLevel = 0; // 脅威度
        this.status = 'DETECTED'; // DETECTED, ENGAGED, DESTROYED, HIT_SHIP
    }

    // 毎秒の移動処理
    updatePosition() {
        if (this.status === 'DETECTED' || this.status === 'ENGAGED') {
            this.range -= this.speedPerSec;
            if (this.range <= 0) {
                this.range = 0;
                this.status = 'HIT_SHIP';
            }
        }
    }

    // 脅威度の計算（距離が近く、速度が速いほど高脅威）
    evaluateThreat() {
        if (this.status === 'DESTROYED' || this.status === 'HIT_SHIP') {
            this.threatLevel = 0;
            return;
        }
        this.threatLevel = (this.speed / this.range).toFixed(2);
    }
}

// 迎撃ミサイル（SM-3 / SM-6等）クラス
class Interceptor {
    constructor(id, targetId, rangeKm) {
        this.id = id;
        this.targetId = targetId;
        this.range = 0; // 発射してからの飛行距離 (km)
        this.targetRangeAtLaunch = rangeKm; // 発射時のターゲットの距離
        this.speedPerSec = 4500 / 3600; // マッハ約3.6 (4500 km/h)
        this.status = 'FLYING'; // FLYING, INTERCEPTED, MISSED
    }

    // 毎秒の飛行処理
    updatePosition(targetRange) {
        this.range += this.speedPerSec;
        // ミサイルの飛行距離 ＋ ターゲットの残り距離が、発射時の距離に達したら交差（着弾）
        if (this.range >= targetRange) {
            return true; // 着弾タイミング
        }
        return false;
    }
}

// イージスシステム統合指揮管理（Command & Decision）クラス
class AegisSystem {
    constructor() {
        this.targets = [];
        this.interceptors = [];
        this.interceptorCount = 0;
        this.shipHp = 100;
        this.radarRange = 400; // AN/SPY-1 レーダー探知範囲 (km)
    }

    // 外部からのターゲット探知入力
    detectTarget(id, rangeKm, speedKmh) {
        if (rangeKm <= this.radarRange) {
            const newTarget = new Target(id, rangeKm, speedKmh);
            this.targets.push(newTarget);
            console.log(`\x1b[31m[SPY-1 RADAR] 警告: 新たな目標探知 -> ID: ${id} | 距離: ${rangeKm}km | 速度: ${speedKmh}km/h\x1b[0m`);
        }
    }

    // シミュレーションのメインループ（1秒＝1サイクル）
    tick() {
        console.log('\n--- Aegis System Tactical Data View ---');
        
        // 1. ターゲットの状態更新と脅威度評価
        this.targets.forEach(t => {
            t.updatePosition();
            t.evaluateThreat();
            if (t.status === 'DETECTED' || t.status === 'ENGAGED') {
                console.log(`[TARGET] ID: ${t.status === 'ENGAGED' ? '\x1b[33m' : ''}${t.id}\x1b[0m | 距離: ${t.range.toFixed(2)}km | 脅威度: ${t.threatLevel}`);
            }
        });

        // 2. 武器自動割り当てアルゴリズム（WCS: Weapon Control System）
        // 脅威度が高い順にソートして、まだ迎撃していない目標に対してミサイルを発射
        const pendingTargets = this.targets
            .filter(t => t.status === 'DETECTED')
            .sort((a, b) => b.threatLevel - a.threatLevel);

        pendingTargets.forEach(t => {
            this.interceptorCount++;
            const intId = `SM-${this.interceptorCount}`;
            const interceptor = new Interceptor(intId, t.id, t.range);
            this.interceptors.push(interceptor);
            t.status = 'ENGAGED';
            console.log(`\x1b[32m[WCS] 自動迎撃シーケンス開始 -> 目標 ${t.id} に対し ${intId} (Standard Missile) を発射！\x1b[0m`);
        });

        // 3. 迎撃ミサイルの追尾・誘導と着弾判定
        this.interceptors = this.interceptors.filter(int => {
            const target = this.targets.find(t => t.id === int.targetId);
            
            if (!target || target.status === 'DESTROYED') {
                console.log(`[MISSILE] ${int.id} は目標をロストしました（無効化）。`);
                return false;
            }

            const isHitTiming = int.updatePosition(target.range);

            if (isHitTiming) {
                // 確率による命中判定（イージスの高精度誘導を考慮し、命中率85%と設定）
                const pk = Math.random(); // Probability of Kill
                if (pk <= 0.85) {
                    target.status = 'DESTROYED';
                    console.log(`\x1b[36m[COMBAT ASSESSMENT] 撃破！ ${int.id} が 目標 ${target.id} の迎撃に成功しました。\x1b[0m`);
                } else {
                    target.status = 'DETECTED'; // 再探知・再迎撃可能状態へ
                    console.log(`\x1b[35m[COMBAT ASSESSMENT] 失敗... ${int.id} は 目標 ${target.id} を逸れました。再迎撃を試みます。\x1b[0m`);
                }
                return false; // 処理が終了したミサイルはリストから除外
            } else {
                console.log(`[MISSILE] ${int.id} 巡航中... 目標 ${int.targetId} まであと ${(target.range).toFixed(2)}km`);
                return true;
            }
        });

        // 4. 被弾判定
        this.targets.forEach(t => {
            if (t.status === 'HIT_SHIP') {
                this.shipHp -= 50;
                t.status = 'DESTROYED'; // 処理終了のため
                console.log(`\x1b[41m\x1b[30m[DAMAGE CONTROL] 警告: 目標 ${t.id} が本艦に直撃！ 残りHP: ${this.shipHp}\x1b[0m`);
                if (this.shipHp <= 0) {
                    console.log('\n\x1b[31m[GAME OVER] イージス艦は轟沈しました。\x1b[0m');
                    process.exit();
                }
            }
        });

        // すべての脅威が消滅したかチェック
        const activeTargets = this.targets.filter(t => t.status === 'DETECTED' || t.status === 'ENGAGED');
        if (activeTargets.length === 0 && this.targets.length > 0 && this.interceptors.length === 0) {
            console.log('\n\x1b[32m[CLEAR] すべての脅威を排除しました。周辺空域の安全を確保。\x1b[0m');
            process.exit();
        }
    }
}

// --- シミュレーション実行 ---
const aegis = new AegisSystem();

// 1秒ごとにシステムを1サイクル進める
const intervalId = setInterval(() => {
    aegis.tick();
}, 1000);

// シナリオデータの投入（時間差で敵の飽和攻撃が発生）
// 探知入力: detectTarget(識別名, 距離km, 速度km/h)
setTimeout(() => aegis.detectTarget('T-01 (対艦ミサイル)', 350, 2500), 1000); // 高速ミサイル
setTimeout(() => aegis.detectTarget('T-02 (戦闘機)', 390, 1200), 2000);     // 通常航空機
setTimeout(() => aegis.detectTarget('T-03 (超音速誘導弾)', 280, 4800), 4000); // 超極音速を想定した超高速ミサイル
