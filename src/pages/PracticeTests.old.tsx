import React, { useState } from 'react';
import styles from './Dashboard.module.css';

interface ParsedResumeData {
  name: string;
  email: string;
  phone: string;
  location?: string;
  summary?: string;
  education: Array<{
    degree: string;
    field?: string;
    institution: string;
    year: string;
    gpa?: string;
  }>;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    duration: string;
    description: string;
  }>;
  projects: Array<{
    title: string;
    tech: string[];
    description: string;
    link?: string;
  }>;
  certifications?: string[];
  languages?: string[];
  links?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
}

interface InterviewQuestion {
  id: number;
  question: string;
  category: string;
  difficulty: string;
  focus_area: string;
}

const PracticeTests: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError('');
      setParsedData(null);
    }
  };

  const handleParseResume = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('http://localhost:8000/api/resume/parse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse resume');
      }

      setParsedData(result.data);
      
      // Automatically generate questions after successful parsing
      await generateQuestions(result.data);
      
    } catch (err: any) {
      console.error('Parse error:', err);
      setError(err.message || 'Failed to parse resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuestions = async (resumeData: ParsedResumeData) => {
    setIsGeneratingQuestions(true);
    try {
      const response = await fetch('http://localhost:8000/api/questions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_data: resumeData,
          num_questions: 10
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error('Failed to generate questions');
      }

      setQuestions(result.questions);
    } catch (err: any) {
      console.error('Question generation error:', err);
      setError('Resume parsed successfully, but failed to generate questions.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const clearResults = () => {
    setSelectedFile(null);
    setParsedData(null);
    setQuestions([]);
    setError('');
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>AI Resume Parser</h1>
        <p className={styles.welcomeSubtitle}>
          Upload your resume in PDF format and let AI extract and analyze the information
        </p>
      </div>

      {/* Upload Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Resume Parser</h3>
          {(selectedFile || parsedData) && (
            <button 
              className={styles.viewAllBtn}
              onClick={clearResults}
              style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px' }}
            >
              Clear
            </button>
          )}
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          {/* File Upload */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label 
              htmlFor="resume-upload"
              style={{
                display: 'inline-block',
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center' as const,
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box' as const,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                {selectedFile ? selectedFile.name : 'Click to upload your resume'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                PDF files only, max 10MB
              </div>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Parse Button */}
          {selectedFile && (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <button
                onClick={handleParseResume}
                disabled={isLoading}
                style={{
                  background: isLoading ? '#94a3b8' : '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? '🔄 Parsing Resume...' : isGeneratingQuestions ? '🤖 Generating Questions...' : '🤖 Parse Resume with AI'}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ color: '#dc2626', fontWeight: 600 }}>❌ Error</div>
              <div style={{ color: '#991b1b', marginTop: '0.25rem' }}>{error}</div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {parsedData && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Parsed Resume Data</h3>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            {/* Personal Information */}
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                👤 Personal Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Name:</strong> {parsedData.name || 'N/A'}
                </div>
                <div>
                  <strong>Email:</strong> {parsedData.email || 'N/A'}
                </div>
                <div>
                  <strong>Phone:</strong> {parsedData.phone || 'N/A'}
                </div>
                {parsedData.location && (
                  <div>
                    <strong>Location:</strong> {parsedData.location}
                  </div>
                )}
              </div>
              {parsedData.summary && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}>
                  <strong>Summary:</strong>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#475569' }}>{parsedData.summary}</p>
                </div>
              )}
              {parsedData.links && (parsedData.links.linkedin || parsedData.links.github || parsedData.links.portfolio) && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {parsedData.links.linkedin && (
                    <a href={parsedData.links.linkedin} target="_blank" rel="noopener noreferrer" 
                       style={{ color: '#0077b5', textDecoration: 'none' }}>🔗 LinkedIn</a>
                  )}
                  {parsedData.links.github && (
                    <a href={parsedData.links.github} target="_blank" rel="noopener noreferrer"
                       style={{ color: '#333', textDecoration: 'none' }}>💻 GitHub</a>
                  )}
                  {parsedData.links.portfolio && (
                    <a href={parsedData.links.portfolio} target="_blank" rel="noopener noreferrer"
                       style={{ color: '#2563eb', textDecoration: 'none' }}>🌐 Portfolio</a>
                  )}
                </div>
              )}
            </div>

            {/* Skills */}
            {parsedData.skills && parsedData.skills.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  🛠️ Skills
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {parsedData.skills.map((skill, index) => (
                    <span
                      key={index}
                      style={{
                        background: '#eff6ff',
                        color: '#2563EB',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.875rem',
                        border: '1px solid #dbeafe'
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {parsedData.education && parsedData.education.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  🎓 Education
                </h4>
                {parsedData.education.map((edu, index) => (
                  <div key={index} style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                    </div>
                    <div style={{ color: '#64748b' }}>{edu.institution}</div>
                    <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                      <span>{edu.year}</span>
                      {edu.gpa && <span>GPA: {edu.gpa}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Experience */}
            {parsedData.experience && parsedData.experience.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  💼 Experience
                </h4>
                {parsedData.experience.map((exp, index) => (
                  <div key={index} style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{exp.title}</div>
                    <div style={{ color: '#64748b' }}>
                      {exp.company}{exp.location ? ` • ${exp.location}` : ''}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{exp.duration}</div>
                    {exp.description && (
                      <div style={{ color: '#475569', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{exp.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Projects */}
            {parsedData.projects && parsedData.projects.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  🚀 Projects
                </h4>
                {parsedData.projects.map((project, index) => (
                  <div key={index} style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                      {project.title}
                      {project.link && (
                        <a href={project.link} target="_blank" rel="noopener noreferrer"
                           style={{ marginLeft: '0.5rem', color: '#2563eb', fontSize: '0.875rem' }}>🔗</a>
                      )}
                    </div>
                    {project.tech && project.tech.length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        {project.tech.map((tech, techIndex) => (
                          <span
                            key={techIndex}
                            style={{
                              background: '#f0fdf4',
                              color: '#15803d',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '0.75rem',
                              fontSize: '0.75rem',
                              marginRight: '0.25rem',
                              border: '1px solid #d4f5da'
                            }}
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                    {project.description && (
                      <div style={{ color: '#475569', fontSize: '0.875rem' }}>{project.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Certifications */}
            {parsedData.certifications && parsedData.certifications.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  📜 Certifications
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {parsedData.certifications.map((cert, index) => (
                    <span
                      key={index}
                      style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.875rem',
                        border: '1px solid #fcd34d'
                      }}
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {parsedData.languages && parsedData.languages.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: '#1e293b', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  🌍 Languages
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {parsedData.languages.map((lang, index) => (
                    <span
                      key={index}
                      style={{
                        background: '#f3e8ff',
                        color: '#7c3aed',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.875rem',
                        border: '1px solid #ddd6fe'
                      }}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interview Questions Section */}
      {questions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>🎯 Interview Questions</h3>
            <span style={{ 
              background: '#dbeafe', 
              color: '#1e40af', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '1rem', 
              fontSize: '0.875rem',
              fontWeight: 600
            }}>
              {questions.length} Questions
            </span>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            <div style={{ 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe', 
              borderRadius: '8px', 
              padding: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.25rem' }}>
                💡 Personalized Questions
              </div>
              <div style={{ color: '#475569', fontSize: '0.875rem' }}>
                These questions are tailored to your resume, focusing on your projects, skills, and experience.
              </div>
            </div>

            {questions.map((q, index) => (
              <div 
                key={q.id} 
                style={{ 
                  marginBottom: '1.5rem', 
                  padding: '1.5rem', 
                  background: index === 0 ? '#fef3c7' : index <= 2 ? '#dbeafe' : '#f8fafc',
                  borderRadius: '8px',
                  border: `2px solid ${index === 0 ? '#fcd34d' : index <= 2 ? '#93c5fd' : '#e2e8f0'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ 
                    background: index === 0 ? '#f59e0b' : index <= 2 ? '#3b82f6' : '#64748b',
                    color: 'white',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    flexShrink: 0
                  }}>
                    {q.id}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: 500, 
                      color: '#1e293b', 
                      marginBottom: '0.75rem',
                      lineHeight: 1.6
                    }}>
                      {q.question}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        background: index === 0 ? '#fef3c7' : index <= 2 ? '#eff6ff' : '#f1f5f9',
                        color: '#475569',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        border: '1px solid #cbd5e1',
                        textTransform: 'capitalize'
                      }}>
                        📂 {q.category}
                      </span>
                      
                      <span style={{
                        background: q.difficulty === 'easy' ? '#dcfce7' : q.difficulty === 'medium' ? '#fef3c7' : '#fecaca',
                        color: q.difficulty === 'easy' ? '#166534' : q.difficulty === 'medium' ? '#92400e' : '#991b1b',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        border: `1px solid ${q.difficulty === 'easy' ? '#bbf7d0' : q.difficulty === 'medium' ? '#fcd34d' : '#fca5a5'}`,
                        textTransform: 'capitalize'
                      }}>
                        {q.difficulty === 'easy' ? '🟢' : q.difficulty === 'medium' ? '🟡' : '🔴'} {q.difficulty}
                      </span>
                      
                      {q.focus_area && (
                        <span style={{
                          background: '#f0fdf4',
                          color: '#15803d',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          border: '1px solid #d4f5da'
                        }}>
                          🎯 {q.focus_area}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              background: '#f0fdf4', 
              borderRadius: '8px', 
              border: '1px solid #bbf7d0',
              textAlign: 'center'
            }}>
              <div style={{ color: '#15803d', fontWeight: 600, marginBottom: '0.5rem' }}>
                ✅ Ready to Practice?
              </div>
              <div style={{ color: '#475569', fontSize: '0.875rem' }}>
                Use these questions to prepare for your interview. Practice answering them out loud!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedFile && !parsedData && !error && (
        <div className={styles.section}>
          <div className={styles.activityList}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🤖</div>
              <p className={styles.emptyText}>AI Resume Parser Ready</p>
              <p className={styles.emptySubtext}>Upload a PDF resume to extract and analyze information using AI</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeTests;