# AppContextMenu 组件结构

## 文件组织

```
AppContextMenu/
├── index.tsx                      # 主入口组件 (70 行)
├── MenuItem.tsx                   # 通用菜单项组件 (18 行)
├── AppMenuItem.tsx                # 应用菜单项组件 (45 行)
├── LoadableOpenWithMenu.tsx       # 打开方式子菜单 (105 行)
├── menus/
│   ├── FileMenuContent.tsx        # 文件/文件夹菜单 (100 行)
│   ├── TextInputMenuContent.tsx   # 文本输入框菜单 (35 行)
│   ├── EmptyAreaMenuContent.tsx   # 空白区域菜单 (50 行)
│   └── SidebarItemMenuContent.tsx # 侧边栏项目菜单 (40 行)
└── README.md                      # 本文档
```

## 组件说明

### 主组件

#### `AppContextMenu` (index.tsx)
- **职责**: 根据 type 渲染不同的菜单内容
- **导出**: 主组件 + 可复用的子组件
- **行数**: ~70 行（原 390 行）

### 可复用组件

#### `MenuItem`
- **职责**: 通用菜单项，支持图标、快捷键、危险操作样式
- **使用场景**: 所有菜单内容组件
- **Props**: `MenuItemProps` (来自 types)

#### `AppMenuItem`
- **职责**: 应用菜单项，异步加载应用图标
- **使用场景**: LoadableOpenWithMenu
- **特性**: 内置图标加载逻辑和缓存

#### `LoadableOpenWithMenu`
- **职责**: "打开方式"子菜单，支持应用列表加载
- **使用场景**: FileMenuContent (仅文件)
- **特性**: 预加载、错误处理、自定义应用选择

### 菜单内容组件

#### `FileMenuContent`
- **适用于**: 文件和文件夹
- **功能**: 打开、打开方式、复制、剪切、粘贴、重命名、删除

#### `TextInputMenuContent`
- **适用于**: 文本输入框
- **功能**: 复制、粘贴、全选

#### `EmptyAreaMenuContent`
- **适用于**: 空白区域
- **功能**: 新建文件、新建文件夹、粘贴、在终端打开、刷新

#### `SidebarItemMenuContent`
- **适用于**: 侧边栏项目
- **功能**: 打开、在终端打开

## 使用示例

### 基本使用
```tsx
import { AppContextMenu } from "@/components/AppContextMenu";

// 文件菜单
<AppContextMenu
  type="file"
  entry={fileEntry}
  fileActions={actions}
>
  <div>右键点击我</div>
</AppContextMenu>

// 文本输入框菜单
<AppContextMenu
  type="text-input"
  textInputActions={textActions}
  asChild
>
  <input type="text" />
</AppContextMenu>
```

### 单独使用子组件
```tsx
import { MenuItem } from "@/components/AppContextMenu";

<MenuItem
  sysIcon={{ type: "sfsymbol", value: "doc.on.doc" }}
  label="复制"
  shortcut="⌘C"
  onClick={handleCopy}
/>
```

## 优化效果

### 代码组织
- ✅ 单一职责原则 - 每个文件只负责一个功能
- ✅ 可维护性 - 修改某个菜单不影响其他菜单
- ✅ 可测试性 - 每个组件可独立测试

### 文件大小
- **优化前**: 1 个文件 390 行
- **优化后**: 8 个文件，平均 50 行/文件
- **主文件**: 从 390 行减少到 70 行 (减少 82%)

### 可复用性
- `MenuItem` 可在其他地方使用
- `AppMenuItem` 可用于其他应用选择场景
- `LoadableOpenWithMenu` 可用于其他需要应用列表的场景

## 依赖关系

```
index.tsx
├── menus/FileMenuContent.tsx
│   ├── MenuItem.tsx
│   └── LoadableOpenWithMenu.tsx
│       └── AppMenuItem.tsx
├── menus/TextInputMenuContent.tsx
│   └── MenuItem.tsx
├── menus/EmptyAreaMenuContent.tsx
│   └── MenuItem.tsx
└── menus/SidebarItemMenuContent.tsx
    └── MenuItem.tsx
```

## 注意事项

1. **导入路径**: 使用相对路径导入同目录下的组件
2. **类型定义**: 所有类型从 `@/types` 导入
3. **常量使用**: 使用 `@/constants/paths` 中的常量
4. **向后兼容**: 主组件的 API 保持不变
