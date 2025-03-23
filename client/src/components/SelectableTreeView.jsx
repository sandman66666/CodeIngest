import React, { useState, useEffect, useRef } from 'react';

const SelectableTreeView = ({ files, selectedFiles, onFileSelect }) => {
  // Function to collect all file paths within a directory
  const getAllFilePaths = (node) => {
    let paths = [];
    
    if (node.isFile) {
      return [node.path];
    }
    
    // Recursively collect paths from all children
    Object.values(node.children).forEach(childNode => {
      if (childNode.isFile) {
        paths.push(childNode.path);
      } else {
        paths = [...paths, ...getAllFilePaths(childNode)];
      }
    });
    
    return paths;
  };
  
  // Check directory selection status (all, some, or none)
  const getDirectorySelectionStatus = (node) => {
    const filePaths = getAllFilePaths(node);
    const selectedCount = filePaths.filter(path => selectedFiles.includes(path)).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === filePaths.length) return 'all';
    return 'some';
  };
  // Convert flat file array to hierarchical structure
  const buildTreeStructure = (files) => {
    const tree = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // This is a file
          current[part] = { 
            isFile: true, 
            path: file.path,
            size: file.size,
            isBusinessLogic: file.isBusinessLogic
          };
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = { isFile: false, children: {} };
          }
          current = current[part].children;
        }
      }
    });
    
    return tree;
  };

  const [treeStructure, setTreeStructure] = useState({});
  
  useEffect(() => {
    if (files && files.length > 0) {
      setTreeStructure(buildTreeStructure(files));
    }
  }, [files]);

  // Handle checkbox changes for both files and directories
  const handleSelectionChange = (node, isChecked) => {
    let updatedSelection = [...selectedFiles];
    
    if (node.isFile) {
      // For files, simply toggle selection
      if (isChecked) {
        if (!updatedSelection.includes(node.path)) {
          updatedSelection.push(node.path);
        }
      } else {
        updatedSelection = updatedSelection.filter(p => p !== node.path);
      }
    } else {
      // For directories, toggle all files within
      const directoryFiles = getAllFilePaths(node);
      
      if (isChecked) {
        // Add all files that aren't already selected
        directoryFiles.forEach(path => {
          if (!updatedSelection.includes(path)) {
            updatedSelection.push(path);
          }
        });
      } else {
        // Remove all files in this directory
        updatedSelection = updatedSelection.filter(path => !directoryFiles.includes(path));
      }
    }
    
    onFileSelect(updatedSelection);
  };

  // Recursive component to render tree nodes
  const TreeNode = ({ name, node, path }) => {
    const currentPath = path ? `${path}/${name}` : name;
    const checkboxRef = useRef(null);
    
    // For directory nodes, determine selection status
    const dirStatus = !node.isFile ? getDirectorySelectionStatus(node) : null;
    const isChecked = node.isFile ? selectedFiles.includes(node.path) : dirStatus === 'all';
    const isIndeterminate = !node.isFile && dirStatus === 'some';
    
    // Set indeterminate state for directory checkboxes
    useEffect(() => {
      if (checkboxRef.current && !node.isFile) {
        checkboxRef.current.indeterminate = isIndeterminate;
      }
    }, [isIndeterminate, node.isFile]);
    
    if (node.isFile) {
      return (
        <div className="tree-node file">
          <label className="checkbox-label">
            <input 
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleSelectionChange(node, e.target.checked)}
            />
            <span className={`file-name ${node.isBusinessLogic ? 'business-logic' : ''}`}>
              {name}
            </span>
            <span className="file-size">
              {formatFileSize(node.size)}
            </span>
          </label>
        </div>
      );
    }
    
    // It's a directory
    return (
      <div className="tree-node directory">
        <div className="directory-header">
          <label className="checkbox-label">
            <input 
              ref={checkboxRef}
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleSelectionChange(node, e.target.checked)}
            />
            <span className="directory-name">{name}</span>
          </label>
        </div>
        <div className="directory-children">
          {Object.entries(node.children).map(([childName, childNode]) => (
            <TreeNode 
              key={childName}
              name={childName}
              node={childNode}
              path={currentPath}
            />
          ))}
        </div>
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="selectable-tree-view">
      {Object.entries(treeStructure).map(([name, node]) => (
        <TreeNode key={name} name={name} node={node} path="" />
      ))}
    </div>
  );
};

export default SelectableTreeView;