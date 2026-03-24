# FileList Component

Refactored file list component with modular structure for better maintainability and performance.

## Structure

```
FileList/
├── index.tsx                    # Main component (240 lines, down from 603)
├── hooks/
│   ├── useFileSort.ts          # Sorting logic
│   ├── useFileSelection.ts     # Selection and rename state
│   └── useFileOperations.ts    # File operations (copy, paste, delete, etc.)
└── components/
    ├── FileListHeader.tsx      # Sortable column headers
    ├── FileListItem.tsx        # List view item (memoized)
    └── FileGridItem.tsx        # Grid view item (memoized)
```

## Custom Hooks

### useFileSort
Manages sorting state and provides sorted entries.
- **State**: sortField, sortDirection
- **Returns**: sortField, sortDirection, handleSort, sortedEntries

### useFileSelection
Manages file selection and rename state.
- **State**: selectedPath, editingPath, editValue
- **Returns**: selectedPath, setSelectedPath, editingPath, setEditingPath, editValue, setEditValue, handleStartRename, handleCancelRename

### useFileOperations
Provides all file operation handlers.
- **Operations**: open, copy, cut, paste, delete, copyPath, newFile, newFolder, openInTerminal
- **Returns**: All operation handlers

## Components

### FileListHeader
Sortable column headers for list view.
- **Props**: sortField, sortDirection, onSort
- **Features**: Click to sort, visual sort indicators

### FileListItem (memoized)
Individual file item in list view.
- **Props**: entry, isSelected, isEditing, editValue, callbacks
- **Features**: Icon, name, size, date, inline rename

### FileGridItem (memoized)
Individual file item in grid view.
- **Props**: entry, isSelected, isEditing, editValue, callbacks
- **Features**: Large icon, name, inline rename

## Performance Optimizations

1. **React.memo**: FileListItem and FileGridItem are memoized to prevent unnecessary re-renders
2. **Custom hooks**: Logic separated for better code splitting and reusability
3. **Modular components**: Smaller components are easier for React to optimize

## Key Features

- Dual view modes (list/grid)
- Sortable columns (name, size, date)
- File operations (copy, cut, paste, delete)
- Inline rename
- Keyboard shortcuts (Cmd+C, Cmd+X, Cmd+V, Backspace, Enter, Space)
- Quick Look preview (Space)
- Context menus
- Directory watching with debounce
- Smart folder support
