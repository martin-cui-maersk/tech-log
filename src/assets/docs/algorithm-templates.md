---
title: 算法与数据结构实战模板
navTitle: 算法模板
category: 算法
order: 8
description: 二分/双指针/链表/二叉树/图/回溯/动态规划的 PHP 模板与刷题方法，附 PHP 写法性能坑
---
# 算法与数据结构实战模板

> **适用场景**：面试前突击、写业务时遇到树形结构/区间查询/TopK/路径规划、想把"想不出来"变成"套模板"。
> **使用方法**：每节先看**什么时候用**，再敲一遍模板代码，最后用一道题验证。模板要背到能默写。

## 目录

- [1. 复杂度分析与刷题方法](#1-复杂度分析与刷题方法)
- [2. 二分查找](#2-二分查找)
- [3. 双指针与滑动窗口](#3-双指针与滑动窗口)
- [4. 哈希与前缀和](#4-哈希与前缀和)
- [5. 链表](#5-链表)
- [6. 二叉树](#6-二叉树)
- [7. 图与网格](#7-图与网格)
- [8. 回溯](#8-回溯)
- [9. 动态规划](#9-动态规划)
- [10. 排序与 TopK](#10-排序与-topk)
- [11. 复杂度速查与 PHP 写法坑](#11-复杂度速查与-php-写法坑)

---

## 1. 复杂度分析与刷题方法

### 1.1 常见量级

| 量级 | n 的规模（1 秒内） | 典型场景 |
| --- | --- | --- |
| `O(1)` | 任意 | 哈希查找、位运算 |
| `O(log n)` | 任意 | 二分、平衡树 |
| `O(n)` | 10^7 ~ 10^8 | 一次遍历、双指针 |
| `O(n log n)` | 10^6 ~ 10^7 | 排序、堆 |
| `O(n²)` | 5000 ~ 10^4 | 双层循环、简单 DP |
| `O(2^n)` / `O(n!)` | n ≤ 20 / 10 | 回溯、状态压缩 |

**看数据范围反推算法**：`n ≤ 20` 想状态压缩或回溯，`n ≤ 10^5` 想 `O(n log n)`，`n ≤ 5000` 才允许 `O(n²)`。

### 1.2 分析方法

- **循环嵌套**：看每层迭代次数，`for i in 1..n: for j in i..n` 是 `O(n²)` 但不是 `2n²`；
- **递归**：画递归树，节点数 × 单节点代价；`T(n) = 2T(n/2) + O(n)` → `O(n log n)`；
- **均摊**：动态数组扩容、并查集路径压缩，单次可能慢，均摊后是 `O(1)`；
- **空间**：别忘了递归栈深度（DFS 最坏 `O(n)`）。

### 1.3 刷题顺序

先按**专题**刷（一个专题 10~15 题，模板固化下来），再按**公司/难度**混合刷。每题必须写：思路一句话、复杂度、边界用例（空、单元素、重复、极值）。

---

## 2. 二分查找

**什么时候用**：数据有序（或"单调性"可判定）、要找**边界**（第一个满足条件的）、答案空间可二分（"最小的最大"这类）。

### 2.1 两个必背模板

```php
<?php
declare(strict_types=1);

// 模板一：找第一个 >= target 的位置（lower_bound），不存在返回 n
function lowerBound(array $nums, int $target): int
{
    $lo = 0;
    $hi = count($nums);            // 左闭右开 [lo, hi)
    while ($lo < $hi) {
        $mid = $lo + intdiv($hi - $lo, 2);   // 防溢出写法
        if ($nums[$mid] < $target) {
            $lo = $mid + 1;        // mid 不可能是答案
        } else {
            $hi = $mid;
        }
    }
    return $lo;
}

// 模板二：找最后一个 <= target 的位置，不存在返回 -1
function upperBound(array $nums, int $target): int
{
    $lo = 0;
    $hi = count($nums) - 1;        // 闭区间 [lo, hi]
    $ans = -1;
    while ($lo <= $hi) {
        $mid = $lo + intdiv($hi - $lo, 2);
        if ($nums[$mid] <= $target) {
            $ans = $mid;           // 记录候选，继续往右找
            $lo = $mid + 1;
        } else {
            $hi = $mid - 1;
        }
    }
    return $ans;
}
```

**死循环的三个原因**：`mid` 计算没用 `lo + (hi-lo)/2`（大数溢出）、区间含义和更新不匹配（左闭右开却写 `hi = mid - 1`）、`lo = mid` 而 `mid` 向下取整导致不动。

### 2.2 答案二分

当"判定条件随答案单调"时，二分的不是数组而是答案：

```php
// 例：把包裹按容量分船，求最小容量（容量越大越容易装下 → 单调）
function shipWithinDays(array $weights, int $days): int
{
    $lo = max($weights);
    $hi = array_sum($weights);
    while ($lo < $hi) {
        $mid = $lo + intdiv($hi - $lo, 2);
        if (canShip($weights, $mid, $days)) {
            $hi = $mid;
        } else {
            $lo = $mid + 1;
        }
    }
    return $lo;
}
```

---

## 3. 双指针与滑动窗口

| 类型 | 用法 | 例题 |
| --- | --- | --- |
| 相向双指针 | 有序数组两数之和、反转、回文判断 | 两数之和 II |
| 同向（快慢） | 去重、原地删除、链表找环/中点 | 删除有序数组重复项 |
| 滑动窗口 | 连续子数组/子串的"最长/最短满足条件" | 最长无重复子串、最小覆盖子串 |

```php
// 滑动窗口通用模板：求"最长"满足条件的窗口
function longestWindow(string $s): int
{
    $count = [];
    $left = 0;
    $best = 0;
    $n = strlen($s);
    for ($right = 0; $right < $n; $right++) {
        $c = $s[$right];
        $count[$c] = ($count[$c] ?? 0) + 1;

        // 不满足条件时收缩左边界
        while (($count[$c] ?? 0) > 1) {
            $count[$s[$left]]--;
            $left++;
        }
        $best = max($best, $right - $left + 1);
    }
    return $best;
}
```

**要点**：窗口内维护的是"状态"（计数、和、字符集），`while` 负责恢复合法性，答案在窗口合法时更新。

---

## 4. 哈希与前缀和

```php
// 两数之和：一次遍历 + 哈希，O(n)
function twoSum(array $nums, int $target): array
{
    $seen = [];
    foreach ($nums as $i => $v) {
        if (isset($seen[$target - $v])) {
            return [$seen[$target - $v], $i];
        }
        $seen[$v] = $i;
    }
    return [];
}

// 前缀和 + 哈希：统计和为 K 的连续子数组个数
function subarraySum(array $nums, int $k): int
{
    $count = [0 => 1];     // 前缀和为 0 出现 1 次（空前缀）
    $sum = 0;
    $ans = 0;
    foreach ($nums as $v) {
        $sum += $v;
        $ans += $count[$sum - $k] ?? 0;
        $count[$sum] = ($count[$sum] ?? 0) + 1;
    }
    return $ans;
}
```

前缀和数组 `pre[i] = a[0] + ... + a[i-1]` 后，区间和 `sum(l..r) = pre[r+1] - pre[l]`，把"求区间"变成"查两个前缀的差"。

---

## 5. 链表

```php
final class ListNode
{
    public function __construct(public int $val = 0, public ?ListNode $next = null) {}
}

// 反转链表（迭代）
function reverseList(?ListNode $head): ?ListNode
{
    $prev = null;
    while ($head !== null) {
        $next = $head->next;
        $head->next = $prev;
        $prev = $head;
        $head = $next;
    }
    return $prev;
}

// 快慢指针找中点 / 判环
function hasCycle(?ListNode $head): bool
{
    $slow = $fast = $head;
    while ($fast !== null && $fast->next !== null) {
        $slow = $slow->next;
        $fast = $fast->next->next;
        if ($slow === $fast) {
            return true;
        }
    }
    return false;
}

// 删除倒数第 n 个：dummy 头 + 双指针保持 n 步间距
function removeNthFromEnd(?ListNode $head, int $n): ?ListNode
{
    $dummy = new ListNode(0, $head);
    $slow = $fast = $dummy;
    for ($i = 0; $i < $n; $i++) {
        $fast = $fast->next;
    }
    while ($fast->next !== null) {
        $slow = $slow->next;
        $fast = $fast->next;
    }
    $slow->next = $slow->next->next;
    return $dummy->next;
}
```

**套路**：涉及头节点可能被删/改时，先加 `dummy`；要"倒数/环/中点"就用快慢指针。

---

## 6. 二叉树

```php
final class TreeNode
{
    public function __construct(
        public int $val = 0,
        public ?TreeNode $left = null,
        public ?TreeNode $right = null,
    ) {}
}

// 中序遍历（迭代版）：一路压左，弹出即访问
function inorderTraversal(?TreeNode $root): array
{
    $out = [];
    $stack = [];
    $cur = $root;
    while ($cur !== null || $stack) {
        while ($cur !== null) {
            $stack[] = $cur;
            $cur = $cur->left;
        }
        $cur = array_pop($stack);
        $out[] = $cur->val;
        $cur = $cur->right;
    }
    return $out;
}

// 层序遍历（BFS）：一次处理一整层
function levelOrder(?TreeNode $root): array
{
    if ($root === null) {
        return [];
    }
    $out = [];
    $queue = [$root];
    while ($queue) {
        $size = count($queue);
        $level = [];
        for ($i = 0; $i < $size; $i++) {
            $node = $queue[$i];              // 注意：用下标遍历代替 array_shift（O(n)）
            $level[] = $node->val;
            if ($node->left) { $queue[] = $node->left; }
            if ($node->right) { $queue[] = $node->right; }
        }
        $queue = array_slice($queue, $size);  // 一次性切掉本层
        $out[] = $level;
    }
    return $out;
}
```

| 题型 | 关键点 |
| --- | --- |
| 最大深度 | `1 + max(左, 右)`，递归返回 |
| 最近公共祖先 | 左右子树都找到 → 当前节点；只一边找到 → 返回那一边 |
| 验证二叉搜索树 | 中序严格递增，或递归带上下界 |
| 二叉搜索树查找/插入 | 按大小往一边走，`O(h)` |
| 翻转/对称 | 递归交换左右，对称判断用"左的左 vs 右的右" |
| 路径和 | 回溯 + 传递剩余值，注意叶子终止条件 |

---

## 7. 图与网格

```php
// 网格 DFS：统计连通块（岛屿数量）
function numIslands(array $grid): int
{
    $rows = count($grid);
    $cols = $rows ? count($grid[0]) : 0;
    $count = 0;

    $dfs = function (int $r, int $c) use (&$grid, $rows, $cols, &$dfs): void {
        if ($r < 0 || $c < 0 || $r >= $rows || $c >= $cols || $grid[$r][$c] !== '1') {
            return;
        }
        $grid[$r][$c] = '0';                    // 标记已访问，别额外开 visited
        $dfs($r + 1, $c);
        $dfs($r - 1, $c);
        $dfs($r, $c + 1);
        $dfs($r, $c - 1);
    };

    for ($r = 0; $r < $rows; $r++) {
        for ($c = 0; $c < $cols; $c++) {
            if ($grid[$r][$c] === '1') {
                $count++;
                $dfs($r, $c);
            }
        }
    }
    return $count;
}

// 拓扑排序（Kahn）：入度为 0 的先出队
function topoSort(int $n, array $edges): array
{
    $graph = array_fill(0, $n, []);
    $indeg = array_fill(0, $n, 0);
    foreach ($edges as [$from, $to]) {
        $graph[$from][] = $to;
        $indeg[$to]++;
    }
    $queue = [];
    for ($i = 0; $i < $n; $i++) {
        if ($indeg[$i] === 0) {
            $queue[] = $i;
        }
    }
    $order = [];
    for ($head = 0; $head < count($queue); $head++) {   // 用下标当队列，避免 array_shift
        $node = $queue[$head];
        $order[] = $node;
        foreach ($graph[$node] as $next) {
            if (--$indeg[$next] === 0) {
                $queue[] = $next;
            }
        }
    }
    return count($order) === $n ? $order : [];   // 长度不足说明有环
}
```

**最短路选择**：边权相同 → BFS；边权非负 → Dijkstra（优先队列）；有负权 → Bellman-Ford / SPFA；多源 → 把所有源先入队。

---

## 8. 回溯

```php
// 通用模板：选择 → 递归 → 撤销选择
function permute(array $nums): array
{
    $res = [];
    $path = [];
    $used = array_fill(0, count($nums), false);

    $backtrack = function () use (&$res, &$path, &$used, $nums, &$backtrack): void {
        if (count($path) === count($nums)) {
            $res[] = $path;              // 注意：PHP 数组按值赋值，这里天然是快照
            return;
        }
        foreach ($nums as $i => $v) {
            if ($used[$i]) {
                continue;
            }
            $used[$i] = true;
            $path[] = $v;
            $backtrack();
            array_pop($path);            // 撤销
            $used[$i] = false;
        }
    };

    $backtrack();
    return $res;
}
```

**剪枝三板斧**：排序后去重（`i > 0 && nums[i] === nums[i-1] && !used[i-1]` 跳过同层重复）、提前判定超出目标、剩余元素不够/太多时直接返回。

---

## 9. 动态规划

**四步法**：① 定义状态 `dp[i]` 的含义（写清"前 i 个/以 i 结尾"）② 写转移方程 ③ 想初始化与边界 ④ 定遍历顺序（保证依赖先算出来）。

```php
// 0-1 背包：容量倒序遍历（每件物品只用一次）
function knapsack01(array $weights, array $values, int $capacity): int
{
    $dp = array_fill(0, $capacity + 1, 0);
    foreach ($weights as $i => $w) {
        for ($c = $capacity; $c >= $w; $c--) {      // 倒序！
            $dp[$c] = max($dp[$c], $dp[$c - $w] + $values[$i]);
        }
    }
    return $dp[$capacity];
}

// 完全背包：容量正序遍历（物品可重复用）
for ($c = $w; $c <= $capacity; $c++) {
    $dp[$c] = max($dp[$c], $dp[$c - $w] + $value);
}

// 最长递增子序列 O(n²) → 贪心 + 二分 O(n log n)
function lengthOfLIS(array $nums): int
{
    $tails = [];                      // tails[k] = 长度为 k+1 的递增子序列的最小结尾
    foreach ($nums as $v) {
        $lo = 0;
        $hi = count($tails);
        while ($lo < $hi) {
            $mid = ($lo + $hi) >> 1;
            if ($tails[$mid] < $v) {
                $lo = $mid + 1;
            } else {
                $hi = $mid;
            }
        }
        $tails[$lo] = $v;             // 替换第一个 >= v 的位置
    }
    return count($tails);
}
```

| 题型 | 状态定义 | 转移要点 |
| --- | --- | --- |
| 爬楼梯 / 斐波那契 | `dp[i]` 方案数 | 只用前两项，可压成两个变量 |
| 打家劫舍 | `dp[i]` 前 i 间最大收益 | `max(dp[i-1], dp[i-2]+a[i])` |
| 零钱兑换 | `dp[c]` 凑成金额 c 的最少硬币 | 完全背包 + 取 min，初值 `INF` |
| 最长公共子序列 | `dp[i][j]` 两前缀的 LCS | 相等取左上 +1，否则取上/左较大 |
| 编辑距离 | `dp[i][j]` 转换最小操作数 | 增/删/改三选一取 min |
| 股票系列 | `dp[i][0/1]` 第 i 天持有/未持有 | 按"可交易次数"加维度 |

---

## 10. 排序与 TopK

| 算法 | 平均 | 最坏 | 稳定 | 适用 |
| --- | --- | --- | --- | --- |
| 快排 | `O(n log n)` | `O(n²)` | 否 | 内存排序首选，随机化主元 |
| 归并 | `O(n log n)` | `O(n log n)` | 是 | 需要稳定、链表排序、外部排序 |
| 堆排 | `O(n log n)` | `O(n log n)` | 否 | 内存受限、要 TopK |
| 计数/桶 | `O(n + k)` | — | 是 | 值域小 |

PHP 的 `sort` / `usort` 从 **8.0 起是稳定排序**（7.x 不稳定，依赖顺序的逻辑要小心）。

```php
// 求第 K 大：维护大小为 K 的小顶堆，O(n log K)
function topK(array $nums, int $k): array
{
    $heap = new SplMinHeap();          // PHP 自带堆
    foreach ($nums as $v) {
        $heap->insert($v);
        if ($heap->count() > $k) {
            $heap->extract();          // 弹出最小的，堆里始终是最大的 k 个
        }
    }
    $out = [];
    while (!$heap->isEmpty()) {
        $out[] = $heap->extract();
    }
    return array_reverse($out);
}
```

海量数据取 TopK：**小顶堆**（内存 `O(k)`）；只求中位数：双堆（大顶堆 + 小顶堆）；数据能全放内存且只要一次：快速选择平均 `O(n)`。

---

## 11. 复杂度速查与 PHP 写法坑

| 操作 | 复杂度 | 备注 |
| --- | --- | --- |
| `array_push` / `$a[] =` | `O(1)` 均摊 | 尾部插入 |
| `array_pop` | `O(1)` | 当栈用 |
| `array_shift` / `array_unshift` | **`O(n)`** | 队列别用它，用下标或 `SplQueue` |
| `isset($a[$k])` / `$a[$k]` | `O(1)` | 哈希表 |
| `in_array($v, $a)` | `O(n)` | 频繁查找先 `array_flip` 成哈希 |
| `array_slice` | `O(len)` | 循环里切数组容易变 `O(n²)` |
| `sort` / `usort` | `O(n log n)` | 8.0+ 稳定 |
| `SplMinHeap` / `SplPriorityQueue` | `O(log n)` | 优先队列、TopK |

**PHP 特有的三个坑**：

1. **`array_shift` 当队列 = `O(n²)`**：BFS 里必须用下标推进（`$queue[$head++]`）或 `SplQueue`；
2. **数组按值赋值**：回溯里 `$res[] = $path` 天然是快照，不需要手动 `array_copy`；但大数组嵌套会吃内存，深拷贝要留意；
3. **递归深度**：PHP 默认没有尾调用优化，DFS 很深时注意 `xdebug.max_nesting_level` 和栈内存，必要时改写成显式栈。
